const express = require('express');
const router = express.Router();
const { getResults, getResultByOrder, createResult, updateResult } = require('../controllers/resultController');
const authGuard = require('../middleware/authGuard');

router.use(authGuard);

router.get('/', getResults);
router.get('/order/:orderId', getResultByOrder);
router.post('/',              createResult);
router.put('/:id',            updateResult);

module.exports = router;
