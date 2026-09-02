import type { Request, Response } from "express";
import Stripe from "stripe";

import { setSubscription } from "../db";

/**
 * Webhook Stripe — met à jour users.subscriptionTier / subscriptionStatus
 * quand un abonnement est créé, mis à jour ou annulé.
 *
 * Monté dans server/_core/index.ts sur `POST /stripe/webhook` AVANT
 * express.json(), avec un body brut (obligatoire pour vérifier la signature).
 *
 * Sans STRIPE_WEBHOOK_SECRET la route répond 200 sans rien faire (no-op),
 * pour ne pas faire échouer les redéploiements tant que Stripe n'est pas
 * configuré.
 */

function tierFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  const map: Record<string, string> = {};
  for (const tier of ["PRO", "EXPERT", "ENTREPRISE"]) {
    for (const suffix of ["MONTH", "YEAR"]) {
      const v = process.env[`STRIPE_PRICE_${tier}_${suffix}`]?.trim();
      if (v) map[v] = tier.toLowerCase();
    }
  }
  return map[priceId] ?? null;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || !key) {
    // Stripe pas encore configuré : on acquitte sans traiter.
    return res.status(200).json({ received: true, skipped: "stripe-not-configured" });
  }

  const stripe = new Stripe(key);
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig as string,
      secret
    );
  } catch (err: any) {
    console.error("[stripe] webhook signature verification failed:", err?.message);
    return res.status(400).json({ error: `Webhook Error: ${err?.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email =
          session.customer_details?.email ?? session.customer_email ?? undefined;
        const userId = session.metadata?.userId
          ? Number(session.metadata.userId)
          : undefined;
        const tier = (session.metadata?.tier ?? "").toLowerCase() || null;
        await setSubscription(
          { email, userId: Number.isFinite(userId) ? userId : undefined },
          { subscriptionTier: tier, subscriptionStatus: "active" }
        );
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const tier =
          (sub.metadata?.tier ?? "").toLowerCase() || tierFromPriceId(priceId);
        const status =
          sub.status === "active" || sub.status === "trialing"
            ? "active"
            : sub.status;
        const customer = await stripe.customers.retrieve(sub.customer as string);
        const email = (customer as Stripe.Customer)?.email ?? undefined;
        await setSubscription(
          { email, userId: sub.metadata?.userId ? Number(sub.metadata.userId) : undefined },
          { subscriptionTier: tier, subscriptionStatus: status }
        );
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(sub.customer as string);
        const email = (customer as Stripe.Customer)?.email ?? undefined;
        await setSubscription(
          { email, userId: sub.metadata?.userId ? Number(sub.metadata.userId) : undefined },
          { subscriptionTier: "free", subscriptionStatus: "canceled" }
        );
        break;
      }
      default:
        break;
    }
  } catch (err: any) {
    console.error("[stripe] webhook handler error:", err?.message);
    return res.status(500).json({ error: "webhook handler failed" });
  }

  return res.status(200).json({ received: true });
}
