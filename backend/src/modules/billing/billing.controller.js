const billingService = require('../../services/billing/BillingService');
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

module.exports = { getStatus, createCheckout };
