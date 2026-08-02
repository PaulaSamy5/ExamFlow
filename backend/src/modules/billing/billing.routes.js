const express = require('express');
const router = express.Router();
const billingController = require('./billing.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/status', authMiddleware, billingController.getStatus);
router.post('/checkout', authMiddleware, billingController.createCheckout);

module.exports = router;
