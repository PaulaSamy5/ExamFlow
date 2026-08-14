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

// ─── Switch plan (upgrade/downgrade an existing subscription, or start a
// new Checkout if there isn't one yet -- see BillingService.changePlan) ───
const changePlan = async (req, res) => {
  const { plan } = req.body;
  try {
    const user = await get('SELECT id, email, name, role FROM Users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const result = await billingService.changePlan(user, plan);
    res.json(result);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('❌ [billing.changePlan]', err.message);
    res.status(500).json({ error: 'Failed to change plan' });
  }
};

// ─── Cancel at period end ───
const cancelSubscription = async (req, res) => {
  try {
    const result = await billingService.cancelSubscription(req.user.id);
    res.json(result);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('❌ [billing.cancelSubscription]', err.message);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

// ─── Undo a pending cancel-at-period-end ───
const resumeSubscription = async (req, res) => {
  try {
    const result = await billingService.resumeSubscription(req.user.id);
    res.json(result);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('❌ [billing.resumeSubscription]', err.message);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
};

// ─── Payment history ───
const getInvoices = async (req, res) => {
  try {
    const invoices = await billingService.getInvoices(req.user.id);
    res.json(invoices);
  } catch (err) {
    console.error('❌ [billing.getInvoices]', err.message);
    res.status(500).json({ error: 'Failed to load payment history' });
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

module.exports = { getStatus, createCheckout, changePlan, cancelSubscription, resumeSubscription, getInvoices, handleWebhook };
