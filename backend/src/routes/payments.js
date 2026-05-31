const express = require('express');
const router = express.Router();
const { getPayments, createPayment, getSummary, voidPayment, refundPayment } = require('../controllers/paymentController');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');

router.use(authGuard);

router.get('/',         getPayments);
router.get('/summary',  getSummary);
router.post('/',        createPayment);
router.patch('/:id/void',   roleGuard(['ADMIN']), voidPayment);
router.patch('/:id/refund', roleGuard(['ADMIN']), refundPayment);

module.exports = router;
