const express = require('express');
const router = express.Router();
const { login, me, requestPasswordResetOtp, confirmPasswordResetOtp } = require('../controllers/authController');
const authGuard = require('../middleware/authGuard');

router.post('/login', login);
router.post('/password-reset/request-otp', requestPasswordResetOtp);
router.post('/password-reset/confirm', confirmPasswordResetOtp);
router.get('/me', authGuard, me);

module.exports = router;
