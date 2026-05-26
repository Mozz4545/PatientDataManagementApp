const express = require('express');
const router = express.Router();
const { getQueues, createQueue, updateQueueStatus, callQueue, callNextQueue, getCurrentCall } = require('../controllers/queueController');
const authGuard = require('../middleware/authGuard');

router.get('/display/current', getCurrentCall);

router.use(authGuard);

router.get('/',             getQueues);
router.post('/',            createQueue);
router.post('/call-next',    callNextQueue);
router.patch('/:id/call',    callQueue);
router.patch('/:id/status', updateQueueStatus);

module.exports = router;
