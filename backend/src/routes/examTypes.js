const express = require('express');
const router = express.Router();
const { getExamTypes, createExamType, updateExamType } = require('../controllers/examTypeController');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');

router.use(authGuard);

router.get('/', getExamTypes);
router.post('/', roleGuard(['ADMIN']), createExamType);
router.put('/:id', roleGuard(['ADMIN']), updateExamType);

module.exports = router;
