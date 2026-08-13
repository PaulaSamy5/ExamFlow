/**
 * Registers (or checks for) the ExamFlow billing webhook endpoint in Stripe
 * test mode, pointed at the deployed Railway backend. Prints the signing
 * secret (STRIPE_WEBHOOK_SECRET) -- only available at creation time, Stripe
 * never exposes it again afterward, so if it's lost the endpoint must be
 * deleted from the Dashboard and re-created (re-run this script).
 * Usage: node backend/scripts/setup-stripe-webhook.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY not found in backend/.env');
  process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY does not look like a test-mode key (must start with sk_test_).');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const WEBHOOK_URL = 'https://examflow-production-7689.up.railway.app/api/billing/webhook';
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
];

(async () => {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const found = existing.data.find(e => e.url === WEBHOOK_URL);

  if (found) {
    console.log(`Webhook endpoint already exists: ${found.id} (${found.status})`);
    console.log(`Enabled events: ${found.enabled_events.join(', ')}`);
    console.log('\nThe signing secret is only shown once, at creation time, and cannot be retrieved again.');
    console.log('If STRIPE_WEBHOOK_SECRET is missing from backend/.env, delete this endpoint in the');
    console.log('Stripe Dashboard (Developers > Webhooks) and re-run this script to get a fresh secret.');
    return;
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: EVENTS,
  });
  console.log(`Created webhook endpoint: ${endpoint.id}`);
  console.log(`Enabled events: ${EVENTS.join(', ')}`);
  console.log('\n--- Add this to backend/.env AND Railway Variables ---');
  console.log(`STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
})().catch(e => {
  console.error('Stripe webhook setup failed:', e.message);
  process.exit(1);
});
