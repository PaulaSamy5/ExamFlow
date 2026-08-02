const { get, run } = require('../../config/db');

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

// Persists the Stripe Customer ID the first time we create one for a user
// (so retrying checkout reuses the same Stripe Customer instead of creating
// duplicates). Row may not exist yet -- upsert on the UNIQUE userId.
const saveStripeCustomerId = async (userId, stripeCustomerId) => {
  await run(
    `INSERT INTO Subscriptions (userId, stripeCustomerId)
     VALUES (?, ?)
     ON CONFLICT (userId) DO UPDATE SET stripeCustomerId = EXCLUDED.stripeCustomerId, updatedAt = NOW()`,
    [userId, stripeCustomerId]
  );
};

module.exports = { getSubscriptionForUser, saveStripeCustomerId };
