import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

import { router, protectedProcedure } from "../_core/trpc";
import { getUserByEmail } from "../db";

/**
 * Tunnel d'abonnement Stripe.
 *
 * Historique : ce routeur était un `router({})` vide — tous les appels du
 * frontend (`stripe.createCheckoutSession`, `stripe.createPortalSession`,
 * `stripe.getSubscription`) renvoyaient un 404 « No procedure found », sans
 * message pour l'utilisateur (rapport QA 2026-09-02, CRIT-2).
 *
 * Le paiement en ligne est piloté par des variables d'environnement Railway.
 * Tant qu'elles ne sont pas renseignées, `getConfig().enabled` vaut `false`
 * (le frontend affiche « Bientôt disponible » au lieu d'un bouton mort) et
 * les mutations renvoient une erreur explicite plutôt qu'un 404 silencieux.
 *
 * Variables attendues :
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_PRO_MONTH / STRIPE_PRICE_PRO_YEAR
 *   STRIPE_PRICE_EXPERT_MONTH / STRIPE_PRICE_EXPERT_YEAR
 *   STRIPE_PRICE_ENTREPRISE_MONTH / STRIPE_PRICE_ENTREPRISE_YEAR
 *   FRONTEND_URL           (pour les URLs de retour success/cancel)
 *   STRIPE_WEBHOOK_SECRET  (utilisé par server/stripe/webhook.ts)
 */

const TierEnum = z.enum(["PRO", "EXPERT", "ENTREPRISE"]);
const IntervalEnum = z.enum(["month", "year"]);

type Tier = z.infer<typeof TierEnum>;
type Interval = z.infer<typeof IntervalEnum>;

export function getStripePriceId(tier: Tier, interval: Interval): string | undefined {
  const key = `STRIPE_PRICE_${tier}_${interval === "month" ? "MONTH" : "YEAR"}`;
  return process.env[key]?.trim() || undefined;
}

export function isStripeConfigured(): boolean {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return false;
  // Au moins un prix doit être défini pour que le tunnel ait un sens.
  return (["PRO", "EXPERT", "ENTREPRISE"] as Tier[]).some(
    (t) => getStripePriceId(t, "month") || getStripePriceId(t, "year")
  );
}

let _stripe: Stripe | null = null;
function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Le paiement en ligne n'est pas encore activé. Contactez-nous à contact@qara.io pour souscrire un abonnement.",
    });
  }
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

function frontendUrl(): string {
  return (process.env.FRONTEND_URL?.trim() || "https://frontend-qara.vercel.app").replace(/\/$/, "");
}

const TIER_LABELS: Record<string, string> = {
  pro: "PRO",
  expert: "EXPERT",
  entreprise: "ENTREPRISE",
};

export const stripeRouter = router({
  /**
   * Le frontend interroge cet endpoint pour savoir s'il doit afficher les
   * boutons d'achat ou un état « Bientôt disponible ».
   */
  getConfig: protectedProcedure.query(() => ({
    enabled: isStripeConfigured(),
  })),

  /**
   * État d'abonnement de l'utilisateur courant — lu depuis la table `users`
   * (colonnes subscriptionTier / subscriptionStatus, alimentées par le
   * webhook Stripe). Ne fait aucun appel réseau : fonctionne toujours.
   * Renvoie les deux conventions de nommage utilisées par le frontend
   * (`tier`/`status` et `subscriptionTier`/`subscriptionStatus`).
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const tier = (ctx.user.subscriptionTier as string | null) ?? null;
    const status = (ctx.user.subscriptionStatus as string | null) ?? (tier ? "active" : "free");
    return {
      tier: tier ?? "free",
      status,
      subscriptionTier: tier ?? "free",
      subscriptionStatus: status,
      subscriptionStartDate: null as string | null,
      stripeCustomerId: null as string | null,
      stripeSubscriptionId: null as string | null,
      isPaid: !!tier && tier !== "free",
    };
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        tier: TierEnum,
        interval: IntervalEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const priceId = getStripePriceId(input.tier, input.interval);
      if (!priceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `L'offre ${input.tier} (${input.interval === "month" ? "mensuelle" : "annuelle"}) n'est pas encore disponible en ligne. Contactez-nous à contact@qara.io.`,
        });
      }
      const stripe = stripeClient();
      const base = frontendUrl();

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: String(ctx.user.id),
        metadata: { userId: String(ctx.user.id), tier: input.tier },
        subscription_data: { metadata: { userId: String(ctx.user.id), tier: input.tier } },
        success_url: `${base}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/subscription/cancel`,
        allow_promotion_codes: true,
      });

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe n'a pas renvoyé d'URL de paiement.",
        });
      }
      return { checkoutUrl: session.url, sessionId: session.id };
    }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const stripe = stripeClient();
    const base = frontendUrl();

    // On retrouve le client Stripe par e-mail (aucune colonne stripeCustomerId
    // dans le schéma actuel).
    const customers = await stripe.customers.list({
      email: ctx.user.email ?? undefined,
      limit: 1,
    });
    const customer = customers.data[0];
    if (!customer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active subscription",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${base}/subscription`,
    });
    return { portalUrl: session.url };
  }),
});

export { TIER_LABELS };
