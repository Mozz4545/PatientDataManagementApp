const express = require('express');
const router = express.Router();
const { getStaff, getStaffOptions, getStaffById, createStaff, updateStaff, resetPassword, deleteStaff } = require('../controllers/staffController');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');

// ใช้สำหรับ dropdown ตอนสร้างใบสั่งตรวจ
router.get('/options', authGuard, getStaffOptions);

// ADMIN เท่านั้นสำหรับหน้าจัดการพนักงาน
router.get('/',    authGuard, roleGuard(['ADMIN']), getStaff);
router.get('/:id', authGuard, roleGuard(['ADMIN']), getStaffById);

// ADMIN เท่านั้น
router.post('/',              authGuard, roleGuard(['ADMIN']), createStaff);
router.put('/:id',            authGuard, roleGuard(['ADMIN']), updateStaff);
router.patch('/:id/password', authGuard, roleGuard(['ADMIN']), resetPassword);
router.delete('/:id',         authGuard, roleGuard(['ADMIN']), deleteStaff);

module.exports = router;
