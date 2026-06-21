const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');
const { getPayments } = require('../controllers/paymentController');
const { getResults } = require('../controllers/resultController');

router.use(authGuard);

router.get('/results', getResults);
router.get('/payments', roleGuard(['ADMIN']), getPayments);

module.exports = router;
