const express = require('express');
const router = express.Router();
const { login, me, logout } = require('../controllers/authController');
const authGuard = require('../middleware/authGuard');
const loginRateLimit = require('../middleware/loginRateLimit');

router.post('/login', loginRateLimit, login);
router.get('/me', authGuard, me);
router.post('/logout', authGuard, logout);

module.exports = router;
