const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify', authController.verifyOTP);


// Developer backdoor for instant switching
router.post('/dev-login', authController.devLogin);

module.exports = router;
