const express = require('express');
const router = express.Router();
const billingController = require('./billing.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/status', authMiddleware, billingController.getStatus);
router.post('/checkout', authMiddleware, billingController.createCheckout);
router.post('/change-plan', authMiddleware, billingController.changePlan);
router.post('/cancel', authMiddleware, billingController.cancelSubscription);
router.post('/resume', authMiddleware, billingController.resumeSubscription);
router.get('/invoices', authMiddleware, billingController.getInvoices);

module.exports = router;
