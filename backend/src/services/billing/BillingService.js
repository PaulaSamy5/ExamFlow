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

module.exports = { getBillingStatus, createCheckoutSession, VALID_PLANS };
