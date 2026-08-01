const { get } = require('../../config/db');

// Subscriptions only ever gets a row once a user's plan actually changes
// away from the default -- so "no row" means FREE, not an error. This keeps
// the table purely additive and avoids backfilling every existing user.
const virtualFreeSubscription = (userId) => ({
  id: null,
  userId,
  plan: 'FREE',
  status: 'ACTIVE',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: 0,
  canceledAt: null,
  couponId: null,
});

const getSubscriptionForUser = async (userId) => {
  const sub = await get('SELECT * FROM Subscriptions WHERE userId = ?', [userId]);
  return sub || virtualFreeSubscription(userId);
};

module.exports = { getSubscriptionForUser };
