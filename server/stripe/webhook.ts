import Stripe from "stripe";
import { getDb } from "../db";
import { userProfiles, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<{ success: boolean; message?: string }> {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return { success: false, message: "Database not available" };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error handling webhook:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userId = parseInt(session.metadata?.user_id || "0");
  const tier = session.metadata?.tier as "PRO" | "EXPERT" | undefined;

  if (!userId || !tier) {
    console.error("Missing user_id or tier in session metadata");
    return;
  }

  // Get the subscription ID from the session
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  // Update user profile with Stripe customer and subscription info
  const existingProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const updateData = {
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: subscriptionId || null,
    subscriptionTier: tier.toLowerCase() as "pro" | "expert" | "entreprise",
    subscriptionStatus: "active" as const,
    subscriptionStartDate: new Date(),
  };

  if (existingProfile.length > 0) {
    await db
      .update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({
      userId,
      ...updateData,
    });
  }

  console.log(
    `Checkout completed for user ${userId}, tier: ${tier}, subscription: ${subscriptionId}`
  );
}

/**
 * Handle subscription update (upgrade/downgrade)
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userId = parseInt(subscription.metadata?.user_id || "0");
  const tier = subscription.metadata?.tier as "PRO" | "EXPERT" | undefined;

  if (!userId) {
    console.error("Missing user_id in subscription metadata");
    return;
  }

  // Determine subscription status
  let status: "active" | "canceled" | "past_due" | "trialing" = "active";
  if (subscription.status === "canceled") status = "canceled";
  else if (subscription.status === "past_due") status = "past_due";
  else if (subscription.status === "trialing") status = "trialing";

  // Update user profile
  await db
    .update(userProfiles)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionTier: tier?.toLowerCase() as "pro" | "expert" | "entreprise" | undefined,
      subscriptionStatus: status,
      subscriptionStartDate: new Date((subscription as any).current_period_start * 1000),
      subscriptionEndDate: new Date((subscription as any).current_period_end * 1000),
    })
    .where(eq(userProfiles.userId, userId));

  console.log(
    `Subscription updated for user ${userId}, status: ${status}, tier: ${tier}`
  );
}

/**
 * Handle subscription deletion (cancellation)
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userId = parseInt(subscription.metadata?.user_id || "0");

  if (!userId) {
    console.error("Missing user_id in subscription metadata");
    return;
  }

  // Downgrade to free tier (inactive)
  await db
    .update(userProfiles)
    .set({
      subscriptionTier: "free",
      subscriptionStatus: "canceled",
      subscriptionEndDate: new Date(),
    })
    .where(eq(userProfiles.userId, userId));

  console.log(`Subscription deleted for user ${userId}, downgraded to free (inactive)`);
}

/**
 * Handle successful invoice payment (renewal)
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const subscriptionId =
    typeof (invoice as any).subscription === "string"
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id;

  if (!subscriptionId) return;

  // Find user by subscription ID and update status to active
  await db
    .update(userProfiles)
    .set({
      subscriptionStatus: "active",
    })
    .where(eq(userProfiles.stripeSubscriptionId, subscriptionId));

  console.log(`Invoice payment succeeded for subscription ${subscriptionId}`);
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const subscriptionId =
    typeof (invoice as any).subscription === "string"
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id;

  if (!subscriptionId) return;

  // Mark subscription as past_due
  await db
    .update(userProfiles)
    .set({
      subscriptionStatus: "past_due",
    })
    .where(eq(userProfiles.stripeSubscriptionId, subscriptionId));

  console.log(`Invoice payment failed for subscription ${subscriptionId}`);
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET!;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
