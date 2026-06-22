const express = require('express');
const router = express.Router();
const { login, me, logout, activity } = require('../controllers/authController');
const authGuard = require('../middleware/authGuard');
const loginRateLimit = require('../middleware/loginRateLimit');

router.post('/login', loginRateLimit, login);
router.get('/me', authGuard, me);
router.post('/activity', authGuard, activity);
router.post('/logout', authGuard, logout);

module.exports = router;
