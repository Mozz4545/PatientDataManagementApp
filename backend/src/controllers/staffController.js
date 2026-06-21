const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const { isAllowed, requiredString, sendServerError } = require('../utils/http');

// GET /api/staff
const getStaff = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, phone, username, role, is_active, deleted_at, created_at FROM staff WHERE is_active = 1 ORDER BY staff_id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    sendServerError(res, err);
  }
};

// GET /api/staff/options
const getStaffOptions = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, role FROM staff WHERE is_active = 1 ORDER BY staff_name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    sendServerError(res, err);
  }
};

// GET /api/staff/:id
const getStaffById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, phone, username, role FROM staff WHERE staff_id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
};

// POST /api/staff
const createStaff = async (req, res) => {
  try {
    const { staff_name, position, department, phone, username, password, role } = req.body;
    const validationMessage = validateStaffPayload({ staff_name, username, password, role }, { requirePassword: true });
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO staff (staff_name, position, department, phone, username, password, role, is_active, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)',
      [staff_name.trim(), position || null, department || null, phone || null, username.trim(), hashed, role || 'STAFF']
    );
    res.status(201).json({ success: true, data: { staff_id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'ຊື່ເຂົ້າລະບົບນີ້ຖືກໃຊ້ແລ້ວ' });
    }
    sendServerError(res, err);
  }
};

// PUT /api/staff/:id
const updateStaff = async (req, res) => {
  try {
    const { staff_name, position, department, phone, username, role } = req.body;
    const validationMessage = validateStaffPayload({ staff_name, username, role }, { requirePassword: false });
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }
    const [result] = await pool.execute(
      'UPDATE staff SET staff_name=?, position=?, department=?, phone=?, username=?, role=? WHERE staff_id=? AND is_active = 1',
      [staff_name.trim(), position || null, department || null, phone || null, username.trim(), role || 'STAFF', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'ຊື່ເຂົ້າລະບົບນີ້ຖືກໃຊ້ແລ້ວ' });
    }
    sendServerError(res, err);
  }
};

// PATCH /api/staff/:id/password
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!requiredString(password) || String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງນ້ອຍ 6 ຕົວອັກສອນ' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute('UPDATE staff SET password=? WHERE staff_id=? AND is_active = 1', [hashed, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    sendServerError(res, err);
  }
};

// DELETE /api/staff/:id
const deleteStaff = async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    if (!staffId) {
      return res.status(400).json({ success: false, message: 'ລະຫັດພະນັກງານບໍ່ຖືກຕ້ອງ' });
    }

    if (Number(req.user?.id) === staffId) {
      return res.status(400).json({ success: false, message: 'ບໍ່ສາມາດລົບບັນຊີທີ່ກຳລັງເຂົ້າລະບົບຢູ່ໄດ້' });
    }

    const [staffRows] = await pool.execute('SELECT staff_id, is_active FROM staff WHERE staff_id = ? LIMIT 1', [staffId]);
    if (!staffRows.length) {
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບຂໍ້ມູນພະນັກງານ' });
    }

    if (Number(staffRows[0].is_active) === 0) {
      return res.json({ success: true, message: 'ພະນັກງານນີ້ຖືກລົບອອກຈາກລາຍຊື່ແລ້ວ' });
    }

    await pool.execute('UPDATE staff SET is_active = 0, deleted_at = NOW() WHERE staff_id = ?', [staffId]);
    res.json({ success: true, message: 'ລົບພະນັກງານອອກຈາກລາຍຊື່ສຳເລັດ' });
  } catch (err) {
    sendServerError(res, err);
  }
};

module.exports = { getStaff, getStaffOptions, getStaffById, createStaff, updateStaff, resetPassword, deleteStaff };

function validateStaffPayload(payload, { requirePassword }) {
  const { staff_name, username, password, role } = payload;
  if (!requiredString(staff_name)) return 'ກະລຸນາປ້ອນຊື່ພະນັກງານ';
  if (!requiredString(username)) return 'ກະລຸນາປ້ອນຊື່ເຂົ້າລະບົບ';
  if (requirePassword && (!requiredString(password) || String(password).length < 6)) {
    return 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງນ້ອຍ 6 ຕົວອັກສອນ';
  }
  if (role && !isAllowed(role, ['ADMIN', 'STAFF'])) return 'ສິດນຳໃຊ້ບໍ່ຖືກຕ້ອງ';
  return null;
}
