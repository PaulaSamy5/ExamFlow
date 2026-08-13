const billingService = require('../../services/billing/BillingService');
const webhookService = require('../../services/billing/WebhookService');
const { get } = require('../../config/db');

// ─── Get Current Billing Status ───
const getStatus = async (req, res) => {
  try {
    const status = await billingService.getBillingStatus(req.user.id);
    res.json(status);
  } catch (err) {
    console.error('❌ [billing.getStatus]', err.message);
    res.status(500).json({ error: 'Failed to load billing status' });
  }
};

// ─── Create a Stripe Checkout Session for a paid plan ───
const createCheckout = async (req, res) => {
  const { plan } = req.body;
  try {
    // JWT payload only carries {id, email, role} -- fetch the current name
    // fresh from the DB for the Stripe Customer record.
    const user = await get('SELECT id, email, name, role FROM Users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const url = await billingService.createCheckoutSession(user, plan);
    res.json({ url });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('❌ [billing.createCheckout]', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

// ─── Stripe Webhook (mounted in app.js with express.raw(), BEFORE the
// global express.json() -- req.body here is the raw Buffer Stripe's
// signature verification requires, not a parsed object) ───
const handleWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  try {
    const result = await webhookService.processWebhookEvent(req.body, signature);
    res.json({ received: true, ...result });
  } catch (err) {
    // Signature failures and processing errors both return 400 so Stripe
    // retries -- a 200 tells Stripe "don't send this again."
    console.error('❌ [billing.webhook]', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
};

module.exports = { getStatus, createCheckout, handleWebhook };
