const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { authMiddleware, adminOnly } = require('../../middleware/auth.middleware');

// Public route for tracking (can be called by anyone/guests)
// We still check for auth if available to link userId, but it's optional
router.post('/track', (req, res, next) => {
  // Extract token if exists for userId linkage
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const jwt = require('jsonwebtoken');
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (e) {}
  }
  next();
}, analyticsController.trackPageView);

// Admin-only routes for viewing stats and exporting
router.get('/stats', authMiddleware, adminOnly, analyticsController.getAnalyticsStats);
router.get('/export', authMiddleware, adminOnly, analyticsController.exportReport);

module.exports = router;
