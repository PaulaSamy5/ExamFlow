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

const getByStripeCustomerId = async (stripeCustomerId) => {
  return get('SELECT * FROM Subscriptions WHERE stripeCustomerId = ?', [stripeCustomerId]);
};

const getByStripeSubscriptionId = async (stripeSubscriptionId) => {
  return get('SELECT * FROM Subscriptions WHERE stripeSubscriptionId = ?', [stripeSubscriptionId]);
};

// Called only from WebhookService, after Stripe confirms a subscription's
// real state -- this is the single place the Subscriptions table is ever
// written to from a "this is now true" (not "user requested") source.
const upsertFromStripeSubscription = async (userId, fields) => {
  await run(
    `INSERT INTO Subscriptions
       (userId, plan, status, stripeCustomerId, stripeSubscriptionId, stripePriceId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, canceledAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (userId) DO UPDATE SET
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       stripeCustomerId = EXCLUDED.stripeCustomerId,
       stripeSubscriptionId = EXCLUDED.stripeSubscriptionId,
       stripePriceId = EXCLUDED.stripePriceId,
       currentPeriodStart = EXCLUDED.currentPeriodStart,
       currentPeriodEnd = EXCLUDED.currentPeriodEnd,
       cancelAtPeriodEnd = EXCLUDED.cancelAtPeriodEnd,
       canceledAt = EXCLUDED.canceledAt,
       updatedAt = NOW()`,
    [
      userId, fields.plan, fields.status, fields.stripeCustomerId, fields.stripeSubscriptionId,
      fields.stripePriceId, fields.currentPeriodStart, fields.currentPeriodEnd,
      fields.cancelAtPeriodEnd ? 1 : 0, fields.canceledAt || null,
    ]
  );
};

module.exports = {
  getSubscriptionForUser,
  saveStripeCustomerId,
  getByStripeCustomerId,
  getByStripeSubscriptionId,
  upsertFromStripeSubscription,
};
