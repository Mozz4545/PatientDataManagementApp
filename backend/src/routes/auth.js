const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const authGuard = require('../middleware/authGuard');

router.post('/login', login);
router.get('/me', authGuard, me);

module.exports = router;
