const pool = require('../db/connection');
const bcrypt = require('bcryptjs');

// GET /api/staff
const getStaff = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, phone, username, role, created_at FROM staff'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/staff/:id
const getStaffById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT staff_id, staff_name, position, department, phone, username, role FROM staff WHERE staff_id = ?',
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
    const { staff_name, position, department, phone, username, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO staff (staff_name, position, department, phone, username, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
    const { staff_name, position, department, phone, role } = req.body;
    const [result] = await pool.execute(
      'UPDATE staff SET staff_name=?, position=?, department=?, phone=?, role=? WHERE staff_id=?',
      [staff_name, position, department, phone, role, req.params.id]
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
    const { password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await pool.execute('UPDATE staff SET password=? WHERE staff_id=?', [hashed, req.params.id]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStaff, getStaffById, createStaff, updateStaff, resetPassword };