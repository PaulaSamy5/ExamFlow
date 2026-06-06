const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware, adminOnly } = require('../../middleware/auth.middleware');

// All admin routes require authentication + admin role
router.use(authMiddleware, adminOnly);

// Dashboard analytics
router.get('/dashboard', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

// System info
router.get('/system', adminController.getSystemInfo);

module.exports = router;
