import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import Stripe from "stripe";
import { STRIPE_PRODUCTS } from "./products";
import { getDb } from "../db";
import { userProfiles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export const stripeRouter = router({
  /**
   * Create a Stripe Checkout Session for subscription
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["PRO", "EXPERT", "ENTREPRISE"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = STRIPE_PRODUCTS[input.tier];
      
      // DEBUG: Log the Price ID being used
      console.log(`[Stripe] Creating checkout session for tier: ${input.tier}`);
      console.log(`[Stripe] Product:`, product);
      console.log(`[Stripe] Price ID (monthly): ${product.priceId}`);
      console.log(`[Stripe] Price ID (yearly): ${product.priceIdYearly}`);
      
      if (!product.priceId) {
        throw new Error("Invalid product tier");
      }

      // Get the origin for redirect URLs
      const origin = ctx.req.headers.origin || "http://localhost:3000";

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: product.priceId,
            quantity: 1,
          },
        ],
        success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscription/cancel`,
        customer_email: ctx.user.email,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email,
          customer_name: ctx.user.name || "",
          tier: input.tier,
        },
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            user_id: ctx.user.id.toString(),
            tier: input.tier,
          },
        },
      });

      return {
        checkoutUrl: session.url!,
        sessionId: session.id,
      };
    }),

  /**
   * Get current user's subscription status
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.user.id))
      .limit(1);

    if (!profile[0]) {
      return {
        tier: "FREE",
        status: "inactive",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
    }

    return {
      tier: profile[0].subscriptionTier || "FREE",
      status: profile[0].subscriptionStatus || "active",
      stripeCustomerId: profile[0].stripeCustomerId,
      stripeSubscriptionId: profile[0].stripeSubscriptionId,
    };
  }),

  /**
   * Create a Customer Portal session for managing subscription
   */
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    // Get user's Stripe customer ID
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.user.id))
      .limit(1);

    if (!profile[0]?.stripeCustomerId) {
      throw new Error("No active subscription found");
    }

    const origin = ctx.req.headers.origin || "http://localhost:3000";

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile[0].stripeCustomerId,
      return_url: `${origin}/subscription`,
    });

    return {
      portalUrl: session.url,
    };
  }),
});
