const express = require('express');
const router = express.Router();
const billingController = require('./billing.controller');
const { authMiddleware, instructorOnly } = require('../../middleware/auth.middleware');

// Subscriptions are instructor-only. Reads (status/invoices) stay open to any
// authenticated role -- a student's status is always FREE with no invoices,
// nothing to protect there -- but every route that can create or change a
// real subscription is gated with the same instructorOnly middleware already
// used for exam-management routes, so a student token can never reach
// Stripe checkout/plan-change/cancel/resume no matter what the frontend does.
router.get('/status', authMiddleware, billingController.getStatus);
router.post('/checkout', authMiddleware, instructorOnly, billingController.createCheckout);
router.post('/change-plan', authMiddleware, instructorOnly, billingController.changePlan);
router.post('/cancel', authMiddleware, instructorOnly, billingController.cancelSubscription);
router.post('/resume', authMiddleware, instructorOnly, billingController.resumeSubscription);
router.get('/invoices', authMiddleware, billingController.getInvoices);

module.exports = router;
