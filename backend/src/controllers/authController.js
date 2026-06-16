const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ensureStaffStatusColumns = async () => {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME IN ('is_active', 'deleted_at')`
  );
  const existing = new Set(rows.map((row) => row.COLUMN_NAME));
  if (!existing.has('is_active')) {
    await pool.execute('ALTER TABLE staff ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
  }
  if (!existing.has('deleted_at')) {
    await pool.execute('ALTER TABLE staff ADD COLUMN deleted_at DATETIME NULL');
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    await ensureStaffStatusColumns();
    const [rows] = await pool.execute(
      'SELECT * FROM staff WHERE username = ? AND is_active = 1',
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      { id: user.staff_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.staff_id,
          name: user.staff_name,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const me = async (req, res) => {
  try {
    await ensureStaffStatusColumns();
    const [rows] = await pool.execute(
      'SELECT staff_id, username, staff_name, role, position FROM staff WHERE staff_id = ? AND is_active = 1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { login, me };
