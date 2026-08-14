// Wraps the Stripe SDK: Customer creation and Checkout Session creation.
// Webhook verification lives in WebhookService, not here.
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('FATAL: STRIPE_SECRET_KEY environment variable is not set.');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  STARTER: process.env.STRIPE_PRICE_ID_STARTER,
  PROFESSIONAL: process.env.STRIPE_PRICE_ID_PROFESSIONAL,
  BUSINESS: process.env.STRIPE_PRICE_ID_BUSINESS,
};

const getPriceIdForPlan = (plan) => PRICE_IDS[plan] || null;

// Reverse lookup used by WebhookService to translate a Stripe subscription's
// current price back into our plan name (e.g. after an upgrade/downgrade).
const getPlanForPriceId = (priceId) => {
  const entry = Object.entries(PRICE_IDS).find(([, id]) => id === priceId);
  return entry ? entry[0] : null;
};

const createCustomer = async (user) => {
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(user.id) },
  });
  return customer.id;
};

// mode: 'subscription' checkout for a recurring paid plan. success_url/cancel_url
// both land back on the user's dashboard -- a query param drives a toast there
// (wired in Milestone 4), the DB update itself always comes from the webhook
// (Milestone 3), never from the redirect, since redirects aren't guaranteed
// to fire and aren't proof a payment actually completed.
const createCheckoutSession = async ({ customerId, plan, userId, role }) => {
  const priceId = getPriceIdForPlan(plan);
  if (!priceId) throw new Error(`No Stripe price configured for plan "${plan}"`);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const dashboardPath = role === 'STUDENT' ? '/student/dashboard' : '/instructor/dashboard';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl}${dashboardPath}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}${dashboardPath}?billing=canceled`,
    client_reference_id: String(userId),
    metadata: { userId: String(userId), plan },
    subscription_data: { metadata: { userId: String(userId), plan } },
  });

  return session.url;
};

// In-place plan change on an EXISTING subscription (upgrade or downgrade
// between paid plans) -- NOT a new Checkout Session, which would create a
// second, duplicate subscription. Stripe prorates the difference by default.
// The Subscriptions row is updated by the resulting customer.subscription.updated
// webhook, same as every other subscription state change.
const changeSubscriptionPlan = async (stripeSubscriptionId, newPlan) => {
  const newPriceId = getPriceIdForPlan(newPlan);
  if (!newPriceId) throw new Error(`No Stripe price configured for plan "${newPlan}"`);

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error('Subscription has no items to update');

  return stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations',
    metadata: { ...subscription.metadata, plan: newPlan },
  });
};

// Cancels at the end of the current billing period (not immediately) --
// the user keeps access through what they've already paid for, matching
// standard SaaS cancellation UX. Synced back via customer.subscription.updated.
const cancelSubscriptionAtPeriodEnd = async (stripeSubscriptionId) => {
  return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
};

// Undoes a pending cancellation set by cancelSubscriptionAtPeriodEnd, as
// long as the subscription hasn't actually ended yet.
const resumeSubscription = async (stripeSubscriptionId) => {
  return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
};

module.exports = {
  createCustomer,
  createCheckoutSession,
  getPriceIdForPlan,
  getPlanForPriceId,
  changeSubscriptionPlan,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
};
