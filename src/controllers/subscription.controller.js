import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { env } from "../config/env.js";

const planMeta = {
  basic: { plan: "BASIC", priceId: env.STRIPE_BASIC_PRICE_ID },
  pro: { plan: "PRO", priceId: env.STRIPE_PRO_PRICE_ID },
};
const updatableStatuses = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

const sortLatest = [{ updatedAt: "desc" }, { createdAt: "desc" }];

const mapStripeStatus = (status) => {
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "past_due") return "PAST_DUE";
  return "CANCELED";
};

function frontendBaseUrl() {
  const url = new URL(env.FRONTEND_URL);
  const lastSegment = url.pathname.split("/").pop() || "";
  if (/\.[a-z0-9]+$/i.test(lastSegment)) {
    url.pathname = url.pathname.replace(/[^/]*$/, "");
  }
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  url.search = "";
  url.hash = "";
  return url;
}

function buildFrontendUrl(relativePath) {
  const base = frontendBaseUrl();
  const rel = String(relativePath).replace(/^\/+/, "");
  const basePath = base.pathname || "/";
  const baseLooksLikePagesDir = /\/pages\/$/i.test(basePath);
  const normalizedRel = baseLooksLikePagesDir ? rel : `pages/${rel}`;
  return new URL(normalizedRel, base).toString();
}

async function getLatestSubscription(userId) {
  return prisma.subscription.findFirst({
    where: { userId },
    orderBy: sortLatest,
  });
}

async function ensureStripeCustomerForUser(userId) {
  const latestSub = await getLatestSubscription(userId);
  if (latestSub?.stripeCustomerId) return latestSub.stripeCustomerId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId },
  });
  return customer.id;
}

async function createBillingPortalRedirect(customerId, returnUrl) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

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

    const latestSub = await getLatestSubscription(req.userId);
    if (
      latestSub?.stripeSubscriptionId &&
      latestSub?.stripeCustomerId &&
      updatableStatuses.has(latestSub.status)
    ) {
      const stripeSub = await stripe.subscriptions.retrieve(latestSub.stripeSubscriptionId, {
        expand: ["items.data.price"],
      });
      const currentItem = stripeSub.items?.data?.[0];
      if (!currentItem?.id) {
        return res.status(400).json({ message: "Existing Stripe subscription item not found" });
      }

      const hasSamePrice = currentItem.price?.id === selected.priceId;
      if (hasSamePrice) {
        return res.json({ message: "Subscription is already on this plan", updated: true });
      }

      const portalUrl = await createBillingPortalRedirect(
        latestSub.stripeCustomerId,
        buildFrontendUrl("home.html?portal=return&intent=plan-change")
      );
      return res.json({
        message: "Redirecting to Stripe to confirm plan change",
        url: portalUrl,
      });
    }

    const customerId = await ensureStripeCustomerForUser(req.userId);
    const successUrl = buildFrontendUrl("thank-you.html");
    const cancelUrl = buildFrontendUrl("subscription.html?checkout=cancel");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: selected.priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7, metadata: { userId: req.userId, plan: selected.plan } },
      success_url: successUrl,
      cancel_url: cancelUrl,
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
    const intent = String(req.body?.intent || "manage").toLowerCase();
    const latest = await prisma.subscription.findFirst({
      where: { userId: req.userId, stripeCustomerId: { not: null } },
      orderBy: sortLatest,
    });
    if (!latest?.stripeCustomerId) {
      return res.status(404).json({ message: "No Stripe customer found" });
    }

    let url = null;
    if (intent === "cancel" && latest?.stripeSubscriptionId) {
      const session = await stripe.billingPortal.sessions.create({
        customer: latest.stripeCustomerId,
        return_url: buildFrontendUrl("profile.html?portal=return&intent=cancel"),
        flow_data: {
          type: "subscription_cancel",
          subscription_cancel: {
            subscription: latest.stripeSubscriptionId,
          },
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: buildFrontendUrl("profile.html?portal=return&intent=cancel"),
            },
          },
        },
      });
      url = session.url;
    } else {
      url = await createBillingPortalRedirect(
        latest.stripeCustomerId,
        buildFrontendUrl("profile.html?portal=return")
      );
    }
    return res.json({ url });
  } catch (error) {
    console.error("Portal error:", error);
    return res.status(500).json({ message: "Failed to create portal session" });
  }
};

export const getCurrentSubscription = async (req, res) => {
  let current = await getLatestSubscription(req.userId);
  if (!current?.stripeCustomerId || !stripe) {
    return res.json({ subscription: current, invoices: [] });
  }

  if (current?.stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(current.stripeSubscriptionId);
      const patchData = {
        status: mapStripeStatus(stripeSub.status),
        currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : current.currentPeriodEnd,
        trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : current.trialEndsAt,
      };
      await prisma.subscription.update({
        where: { id: current.id },
        data: patchData,
      });
      current = {
        ...current,
        ...patchData,
        cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
        canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
      };
    } catch (err) {
      // Keep response working even if Stripe retrieve has a transient issue.
      current = {
        ...current,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      };
    }
  } else {
    current = {
      ...current,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    };
  }

  const invoices = await stripe.invoices.list({
    customer: current.stripeCustomerId,
    limit: 10,
  });

  const formattedInvoices = invoices.data.map((invoice) => ({
    id: invoice.id,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    status: invoice.status,
    amountPaid: invoice.amount_paid,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    created: invoice.created,
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
  }));

  return res.json({ subscription: current, invoices: formattedInvoices });
};
