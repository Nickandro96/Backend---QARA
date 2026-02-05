import { Request, Response } from "express";
import { handleStripeWebhook, verifyWebhookSignature } from "./webhook";

/**
 * Stripe webhook endpoint handler
 * This must be registered as a raw body endpoint in Express
 */
export async function stripeWebhookEndpoint(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];

  if (!signature || typeof signature !== "string") {
    console.error("Missing stripe-signature header");
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  try {
    // Verify webhook signature and construct event
    const event = verifyWebhookSignature(req.body, signature);

    console.log(`Received Stripe webhook: ${event.type}`);

    // Handle the event
    const result = await handleStripeWebhook(event);

    if (!result.success) {
      console.error(`Webhook handling failed: ${result.message}`);
      return res.status(500).json({ error: result.message });
    }

    // Return success response to Stripe
    return res.json({ received: true });
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return res
      .status(400)
      .json({ error: "Webhook signature verification failed" });
  }
}
