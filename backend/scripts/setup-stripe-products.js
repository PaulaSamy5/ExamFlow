/**
 * Idempotent Stripe test-mode setup: creates (or reuses) the ExamFlow
 * Starter/Professional/Business products + monthly recurring prices, and
 * prints the resulting STRIPE_PRICE_ID_* env vars to add to backend/.env.
 * Refuses to run against anything but a sk_test_ key.
 * Usage: node backend/scripts/setup-stripe-products.js
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

const PLANS = [
  { key: 'STARTER', name: 'ExamFlow Starter', amount: 2900 },
  { key: 'PROFESSIONAL', name: 'ExamFlow Professional', amount: 7900 },
  { key: 'BUSINESS', name: 'ExamFlow Business', amount: 14900 },
];

(async () => {
  const results = {};
  for (const plan of PLANS) {
    // Idempotent: if a product with this exact name already exists, reuse it
    // instead of creating a duplicate on repeated runs.
    const existingProducts = await stripe.products.search({ query: `name:'${plan.name}'` });
    let product = existingProducts.data[0];
    if (!product) {
      product = await stripe.products.create({ name: plan.name });
      console.log(`Created product: ${plan.name} (${product.id})`);
    } else {
      console.log(`Reusing existing product: ${plan.name} (${product.id})`);
    }

    const existingPrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    let price = existingPrices.data.find(p => p.unit_amount === plan.amount && p.recurring?.interval === 'month');
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amount,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log(`Created price: $${plan.amount / 100}/mo (${price.id})`);
    } else {
      console.log(`Reusing existing price: $${plan.amount / 100}/mo (${price.id})`);
    }

    results[plan.key] = { productId: product.id, priceId: price.id };
  }

  console.log('\n--- Add these to backend/.env ---');
  for (const plan of PLANS) {
    console.log(`STRIPE_PRICE_ID_${plan.key}=${results[plan.key].priceId}`);
  }
})().catch(e => {
  console.error('Stripe setup failed:', e.message);
  process.exit(1);
});
