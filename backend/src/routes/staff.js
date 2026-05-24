const express = require('express');
const router = express.Router();
const { getStaff, getStaffById, createStaff, updateStaff, resetPassword } = require('../controllers/staffController');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');

// ทุกคนดูได้
router.get('/',    authGuard, getStaff);
router.get('/:id', authGuard, getStaffById);

// ADMIN เท่านั้น
router.post('/',              authGuard, roleGuard(['ADMIN']), createStaff);
router.put('/:id',            authGuard, roleGuard(['ADMIN']), updateStaff);
router.patch('/:id/password', authGuard, roleGuard(['ADMIN']), resetPassword);

module.exports = router;