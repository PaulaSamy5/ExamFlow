const subscriptionService = require('./SubscriptionService');

// Orchestrates billing reads/writes for controllers. Checkout Session
// creation (StripeService) and webhook-driven activation (WebhookService)
// land in later milestones -- this only supports read-only status for now.
const getBillingStatus = async (userId) => {
  const sub = await subscriptionService.getSubscriptionForUser(userId);
  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
  };
};

module.exports = { getBillingStatus };
