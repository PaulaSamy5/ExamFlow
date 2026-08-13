// Verifies Stripe webhook signatures and turns confirmed subscription
// lifecycle events into Subscriptions/Invoices/SubscriptionEvents writes.
// This is the ONLY place that ever marks a subscription as actually paid --
// Checkout redirects (success_url) are never trusted for that, since a
// redirect firing isn't proof a payment actually completed.
const Stripe = require('stripe');
const { run, get } = require('../../config/db');
const subscriptionService = require('./SubscriptionService');
const stripeService = require('./StripeService');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('FATAL: STRIPE_SECRET_KEY environment variable is not set.');
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('FATAL: STRIPE_WEBHOOK_SECRET environment variable is not set.');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe's subscription.status values don't line up 1:1 with our
// CHK_Subscription_Status check constraint -- normalize with a safe fallback
// so an unexpected Stripe status can never crash the webhook handler.
const STATUS_MAP = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELED',
  unpaid: 'PAST_DUE',
  paused: 'PAST_DUE',
};
const mapStatus = (stripeStatus) => STATUS_MAP[stripeStatus] || 'INCOMPLETE';

const toDate = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000) : null);

const resolveUserId = async (subscriptionOrSession) => {
  const metaUserId = subscriptionOrSession.metadata?.userId;
  if (metaUserId) return parseInt(metaUserId, 10);
  // Fallback: look up by whichever Stripe ID we already have on file.
  const byCustomer = subscriptionOrSession.customer
    ? await subscriptionService.getByStripeCustomerId(subscriptionOrSession.customer)
    : null;
  return byCustomer?.userId ?? null;
};

const handleCheckoutCompleted = async (event) => {
  const session = event.data.object;
  if (session.mode !== 'subscription' || !session.subscription) return; // not a plan checkout

  const userId = session.client_reference_id
    ? parseInt(session.client_reference_id, 10)
    : await resolveUserId(session);
  if (!userId) { console.warn('[webhook] checkout.session.completed: no resolvable userId', session.id); return; }

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = session.metadata?.plan || stripeService.getPlanForPriceId(priceId) || 'FREE';

  await subscriptionService.upsertFromStripeSubscription(userId, {
    plan,
    status: mapStatus(subscription.status),
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodStart: toDate(subscription.current_period_start),
    currentPeriodEnd: toDate(subscription.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
  });
};

const handleSubscriptionUpdated = async (event) => {
  const subscription = event.data.object;
  const userId = await resolveUserId(subscription);
  if (!userId) { console.warn('[webhook] subscription.updated: no resolvable userId', subscription.id); return; }

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = stripeService.getPlanForPriceId(priceId) || subscription.metadata?.plan || 'FREE';

  await subscriptionService.upsertFromStripeSubscription(userId, {
    plan,
    status: mapStatus(subscription.status),
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodStart: toDate(subscription.current_period_start),
    currentPeriodEnd: toDate(subscription.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
  });
};

const handleSubscriptionDeleted = async (event) => {
  const subscription = event.data.object;
  const userId = await resolveUserId(subscription);
  if (!userId) { console.warn('[webhook] subscription.deleted: no resolvable userId', subscription.id); return; }

  // Subscription is truly gone -- revert to FREE rather than leaving a
  // dangling paid plan with no active Stripe subscription behind it.
  await subscriptionService.upsertFromStripeSubscription(userId, {
    plan: 'FREE',
    status: 'CANCELED',
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: toDate(subscription.canceled_at) || new Date(),
  });
};

const handleInvoicePaid = async (event) => {
  const invoice = event.data.object;
  const sub = invoice.customer ? await subscriptionService.getByStripeCustomerId(invoice.customer) : null;
  if (!sub) { console.warn('[webhook] invoice.paid: no matching subscription for customer', invoice.customer); return; }

  await run(
    `INSERT INTO Invoices (userId, subscriptionId, stripeInvoiceId, amountPaid, currency, status, invoicePdfUrl, hostedInvoiceUrl, periodStart, periodEnd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (stripeInvoiceId) DO NOTHING`,
    [
      sub.userId, sub.id, invoice.id, (invoice.amount_paid || 0) / 100, invoice.currency || 'usd',
      invoice.status, invoice.invoice_pdf || null, invoice.hosted_invoice_url || null,
      toDate(invoice.period_start), toDate(invoice.period_end),
    ]
  );
};

const HANDLERS = {
  'checkout.session.completed': handleCheckoutCompleted,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'invoice.paid': handleInvoicePaid,
};

// Verifies the signature (throws if invalid -- caller returns 400), then
// processes the event exactly once. stripeEventId is UNIQUE, so a retried
// delivery of an event we've already recorded is a safe no-op.
const processWebhookEvent = async (rawBody, signature) => {
  const event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

  const already = await get('SELECT id FROM SubscriptionEvents WHERE stripeEventId = ?', [event.id]);
  if (already) return { duplicate: true, type: event.type };

  const handler = HANDLERS[event.type];
  if (handler) await handler(event);

  const userId = event.data.object.metadata?.userId
    ? parseInt(event.data.object.metadata.userId, 10)
    : null;

  await run(
    `INSERT INTO SubscriptionEvents (userId, eventType, stripeEventId, payload)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (stripeEventId) DO NOTHING`,
    [userId, event.type, event.id, JSON.stringify(event.data.object).slice(0, 8000)]
  );

  return { duplicate: false, type: event.type, handled: !!handler };
};

module.exports = { processWebhookEvent };
