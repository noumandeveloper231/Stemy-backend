import { stripe } from "../lib/stripe.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const mapStatus = (status) => {
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "past_due") return "PAST_DUE";
  if (status === "unpaid" || status === "incomplete_expired") return "CANCELED";
  return "CANCELED";
};

const planFromStripeSub = (sub) => {
  if (sub?.metadata?.plan === "PRO") return "PRO";
  if (sub?.metadata?.plan === "BASIC") return "BASIC";
  const priceId = sub?.items?.data?.[0]?.price?.id;
  if (priceId && priceId === env.STRIPE_PRO_PRICE_ID) return "PRO";
  return "BASIC";
};

export const handleStripeWebhook = async (req, res) => {
  try {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ message: "Stripe webhook not configured" });
    }

    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    console.log("[Stripe Webhook] Received", {
      id: event.id,
      type: event.type,
      livemode: event.livemode,
      created: event.created,
    });

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;
      console.log("[Stripe Webhook] Subscription payload", {
        eventType: event.type,
        subscriptionId: sub.id,
        customerId: sub.customer,
        status: sub.status,
        metadataPlan: sub.metadata?.plan || null,
      });
      const existingBySubId = sub.id
        ? await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: sub.id },
            select: { id: true, userId: true, stripeCustomerId: true, stripeSubscriptionId: true },
          })
        : null;
      const existingByCustomerId = sub.customer
        ? await prisma.subscription.findUnique({
            where: { stripeCustomerId: sub.customer },
            select: { id: true, userId: true, stripeCustomerId: true, stripeSubscriptionId: true },
          })
        : null;

      let userId = sub.metadata?.userId || existingBySubId?.userId || existingByCustomerId?.userId || null;
      if (!userId) {
        console.log("[Stripe Webhook] Missing userId after metadata/sub/customer lookup", {
          subscriptionId: sub.id,
          customerId: sub.customer,
        });
      }

      const targetRecord = existingBySubId || existingByCustomerId;
      console.log("[Stripe Webhook] Record lookup", {
        bySubscriptionId: Boolean(existingBySubId),
        byCustomerId: Boolean(existingByCustomerId),
        targetRecordId: targetRecord?.id || null,
      });
      if (userId) {
        const updateData = {
          userId,
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          plan: planFromStripeSub(sub),
          status: mapStatus(sub.status),
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        };

        if (targetRecord?.id) {
          await prisma.subscription.update({
            where: { id: targetRecord.id },
            data: updateData,
          });
        } else {
          await prisma.subscription.create({
            data: updateData,
          });
        }
        console.log("[Stripe Webhook] Subscription synced", {
          action: targetRecord ? "update" : "create",
          userId,
          subscriptionId: sub.id,
          customerId: sub.customer,
          mappedPlan: planFromStripeSub(sub),
          mappedStatus: mapStatus(sub.status),
        });
      } else {
        console.warn("[Stripe Webhook] Could not map subscription to user", {
          subscriptionId: sub.id,
          eventType: event.type,
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      console.log("[Stripe Webhook] Invoice payment failed", {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
      });
      await prisma.subscription.updateMany({
        where: { stripeCustomerId: invoice.customer },
        data: { status: "PAST_DUE" },
      });
      console.log("[Stripe Webhook] Marked subscriptions as PAST_DUE", { customerId: invoice.customer });
    }

    if (
      event.type !== "customer.subscription.created" &&
      event.type !== "customer.subscription.updated" &&
      event.type !== "customer.subscription.deleted" &&
      event.type !== "invoice.payment_failed"
    ) {
      console.log("[Stripe Webhook] Ignored event type", { type: event.type });
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", {
      message: error.message,
      type: error.type,
      stack: error.stack,
    });
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};
