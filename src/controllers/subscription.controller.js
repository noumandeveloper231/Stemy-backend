import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { env } from "../config/env.js";

const planMeta = {
  basic: { plan: "BASIC", priceId: env.STRIPE_BASIC_PRICE_ID },
  pro: { plan: "PRO", priceId: env.STRIPE_PRO_PRICE_ID },
};

function stripePriceIdError(priceId, envName) {
  if (!priceId || !String(priceId).trim()) {
    return `${envName} is not set. Add a Stripe Price ID (starts with price_) to your server .env.`;
  }
  const id = String(priceId).trim();
  if (id.startsWith("prod_")) {
    return `${envName} is a Product ID (${id.slice(0, 14)}…). Checkout requires a Price ID: Stripe Dashboard → Products → open the product → under Pricing copy the Price ID (price_…), not the Product ID.`;
  }
  if (!id.startsWith("price_")) {
    return `${envName} should be a Stripe recurring Price ID starting with "price_". Current value does not look like a price id.`;
  }
  return null;
}

export const createCheckoutSession = async (req, res) => {
  try {
    const { plan } = req.body;
    const selected = planMeta[String(plan || "").toLowerCase()];
    if (!selected?.priceId) {
      return res.status(400).json({ message: "Invalid plan or price id missing" });
    }
    const planKey = String(plan || "").toLowerCase();
    const envName = planKey === "basic" ? "STRIPE_BASIC_PRICE_ID" : "STRIPE_PRO_PRICE_ID";
    const priceFormatErr = stripePriceIdError(selected.priceId, envName);
    if (priceFormatErr) {
      return res.status(400).json({ message: priceFormatErr });
    }
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured" });
    }

    let customerId = null;
    const latestSub = await prisma.subscription.findFirst({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    if (latestSub?.stripeCustomerId) {
      customerId = latestSub.stripeCustomerId;
    } else {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: req.userId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: selected.priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7, metadata: { userId: req.userId, plan: selected.plan } },
      success_url: `${env.FRONTEND_URL}?checkout=success`,
      cancel_url: `${env.FRONTEND_URL}?checkout=cancel`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(500).json({ message: "Failed to create checkout session" });
  }
};

export const createPortalSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured" });
    }
    const latest = await prisma.subscription.findFirst({
      where: { userId: req.userId, stripeCustomerId: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!latest?.stripeCustomerId) {
      return res.status(404).json({ message: "No Stripe customer found" });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: latest.stripeCustomerId,
      return_url: env.FRONTEND_URL,
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error("Portal error:", error);
    return res.status(500).json({ message: "Failed to create portal session" });
  }
};

export const getCurrentSubscription = async (req, res) => {
  const current = await prisma.subscription.findFirst({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ subscription: current });
};
