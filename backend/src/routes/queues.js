const express = require('express');
const router = express.Router();
const { getQueues, createQueue, updateQueueStatus } = require('../controllers/queueController');
const authGuard = require('../middleware/authGuard');

router.use(authGuard);

router.get('/',             getQueues);
router.post('/',            createQueue);
router.patch('/:id/status', updateQueueStatus);

module.exports = router;