const express = require('express');
const router = express.Router();
const { getPayments, createPayment, getSummary } = require('../controllers/paymentController');
const authGuard = require('../middleware/authGuard');

router.use(authGuard);

router.get('/',         getPayments);
router.get('/summary',  getSummary);
router.post('/',        createPayment);

module.exports = router;