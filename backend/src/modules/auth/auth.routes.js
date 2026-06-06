const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify', authController.verifyOTP);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.patch('/profile', authMiddleware, authController.updateProfile);

module.exports = router;
