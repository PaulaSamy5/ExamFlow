const billingService = require('../../services/billing/BillingService');

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

module.exports = { getStatus };
