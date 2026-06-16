const pool = require('../db/connection');
const bcrypt = require('bcryptjs');

const ensureStaffColumns = async () => {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME IN ('department', 'phone', 'is_active', 'deleted_at')`
  );
  const existing = new Set(rows.map((row) => row.COLUMN_NAME));
  if (!existing.has('department')) {
    await pool.execute('ALTER TABLE staff ADD COLUMN department VARCHAR(100) NULL');
  }
  if (!existing.has('phone')) {
    await pool.execute('ALTER TABLE staff ADD COLUMN phone VARCHAR(20) NULL');
  }
  if (!existing.has('is_active')) {
    await pool.execute('ALTER TABLE staff ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
  }
  if (!existing.has('deleted_at')) {
    await pool.execute('ALTER TABLE staff ADD COLUMN deleted_at DATETIME NULL');
  }
};

// GET /api/staff
const getStaff = async (req, res) => {
  try {
    await ensureStaffColumns();
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, phone, username, role, is_active, deleted_at, created_at FROM staff WHERE is_active = 1 ORDER BY staff_id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/staff/options
const getStaffOptions = async (req, res) => {
  try {
    await ensureStaffColumns();
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, role FROM staff WHERE is_active = 1 ORDER BY staff_name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/staff/:id
const getStaffById = async (req, res) => {
  try {
    await ensureStaffColumns();
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, phone, username, role FROM staff WHERE staff_id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/staff
const createStaff = async (req, res) => {
  try {
    await ensureStaffColumns();
    const { staff_name, position, department, phone, username, password, role } = req.body;
    if (!staff_name || !username || !password) {
      return res.status(400).json({ success: false, message: 'staff_name, username and password are required' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO staff (staff_name, position, department, phone, username, password, role, is_active, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)',
      [staff_name, position, department, phone, username, hashed, role || 'STAFF']
    );
    res.status(201).json({ success: true, data: { staff_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/staff/:id
const updateStaff = async (req, res) => {
  try {
    await ensureStaffColumns();
    const { staff_name, position, department, phone, username, role } = req.body;
    if (!staff_name || !username) {
      return res.status(400).json({ success: false, message: 'staff_name and username are required' });
    }
    const [result] = await pool.execute(
      'UPDATE staff SET staff_name=?, position=?, department=?, phone=?, username=?, role=? WHERE staff_id=? AND is_active = 1',
      [staff_name, position, department, phone, username, role || 'STAFF', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/staff/:id/password
const resetPassword = async (req, res) => {
  try {
    await ensureStaffColumns();
    const { password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute('UPDATE staff SET password=? WHERE staff_id=? AND is_active = 1', [hashed, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/staff/:id
const deleteStaff = async (req, res) => {
  try {
    await ensureStaffColumns();
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
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStaff, getStaffOptions, getStaffById, createStaff, updateStaff, resetPassword, deleteStaff };
