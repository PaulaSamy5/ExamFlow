const subscriptionService = require('./SubscriptionService');
const stripeService = require('./StripeService');

const VALID_PLANS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'];

// Orchestrates billing reads/writes for controllers.
const getBillingStatus = async (userId) => {
  const sub = await subscriptionService.getSubscriptionForUser(userId);
  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
    // Lets the frontend decide which buttons make sense to show (e.g. no
    // Cancel button when there's no real Stripe subscription behind FREE)
    // without exposing the raw Stripe IDs to the client.
    hasActiveSubscription: !!sub.stripeSubscriptionId && sub.status !== 'CANCELED',
  };
};

// Ensures a Stripe Customer exists for this user (creating + persisting one
// on first use), then creates a real Checkout Session for the requested
// paid plan and returns its redirect URL.
const createCheckoutSession = async (user, plan) => {
  if (!VALID_PLANS.includes(plan)) {
    throw Object.assign(new Error(`Invalid plan: ${plan}`), { status: 400 });
  }

  const sub = await subscriptionService.getSubscriptionForUser(user.id);
  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    customerId = await stripeService.createCustomer(user);
    await subscriptionService.saveStripeCustomerId(user.id, customerId);
  }

  return stripeService.createCheckoutSession({ customerId, plan, userId: user.id, role: user.role });
};

// Switches plan for a user who ALREADY has an active paid subscription
// (in-place proration update). If they don't have one yet -- still on
// FREE, or a past subscription that's fully ended -- this transparently
// falls back to a normal new Checkout Session instead of erroring, so the
// same "Upgrade" button works correctly in either state.
const changePlan = async (user, plan) => {
  if (!VALID_PLANS.includes(plan)) {
    throw Object.assign(new Error(`Invalid plan: ${plan}`), { status: 400 });
  }

  const sub = await subscriptionService.getSubscriptionForUser(user.id);
  if (!sub.stripeSubscriptionId || sub.status === 'CANCELED') {
    const url = await createCheckoutSession(user, plan);
    return { type: 'checkout', url };
  }

  if (sub.plan === plan) {
    throw Object.assign(new Error(`Already on the ${plan} plan`), { status: 400 });
  }

  await stripeService.changeSubscriptionPlan(sub.stripeSubscriptionId, plan);
  return { type: 'updated' };
};

const cancelSubscription = async (userId) => {
  const sub = await subscriptionService.getSubscriptionForUser(userId);
  if (!sub.stripeSubscriptionId || sub.status === 'CANCELED') {
    throw Object.assign(new Error('No active subscription to cancel'), { status: 400 });
  }
  await stripeService.cancelSubscriptionAtPeriodEnd(sub.stripeSubscriptionId);
  return { type: 'canceled' };
};

const resumeSubscription = async (userId) => {
  const sub = await subscriptionService.getSubscriptionForUser(userId);
  if (!sub.stripeSubscriptionId || !sub.cancelAtPeriodEnd) {
    throw Object.assign(new Error('No pending cancellation to undo'), { status: 400 });
  }
  await stripeService.resumeSubscription(sub.stripeSubscriptionId);
  return { type: 'resumed' };
};

const getInvoices = async (userId) => {
  return subscriptionService.getInvoicesForUser(userId);
};

module.exports = {
  getBillingStatus,
  createCheckoutSession,
  changePlan,
  cancelSubscription,
  resumeSubscription,
  getInvoices,
  VALID_PLANS,
};
