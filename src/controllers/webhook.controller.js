import { stripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const mapStatus = (status) => {
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "past_due") return "PAST_DUE";
  return "CANCELED";
};

export const handleStripeWebhook = async (req, res) => {
  try {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ message: "Stripe webhook not configured" });
    }

    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      if (userId) {
        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: sub.id },
          create: {
            userId,
            stripeCustomerId: sub.customer,
            stripeSubscriptionId: sub.id,
            plan: sub.metadata?.plan === "PRO" ? "PRO" : "BASIC",
            status: mapStatus(sub.status),
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          },
          update: {
            stripeCustomerId: sub.customer,
            status: mapStatus(sub.status),
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          },
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      await prisma.subscription.updateMany({
        where: { stripeCustomerId: invoice.customer },
        data: { status: "PAST_DUE" },
      });
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};
