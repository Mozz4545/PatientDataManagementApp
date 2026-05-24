const express = require('express');
const router = express.Router();
const { getOrders, getOrderById, createOrder, updateOrderStatus } = require('../controllers/orderController');
const authGuard = require('../middleware/authGuard');

router.use(authGuard);

router.get('/',            getOrders);
router.get('/:id',         getOrderById);
router.post('/',           createOrder);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;