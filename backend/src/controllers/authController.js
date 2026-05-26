const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const normalizePhone = (value = '') => String(value).replace(/[\s-]/g, '');

const ensurePasswordResetOtpTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      otp_id INT PRIMARY KEY AUTO_INCREMENT,
      staff_id INT NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      attempts INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_reset_staff (staff_id),
      INDEX idx_password_reset_expires (expires_at),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
    )
  `);
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM staff WHERE username = ?',
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    
    if (!valid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
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
          role: user.role
        }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT staff_id, username, staff_name, role, position FROM staff WHERE staff_id = ?',
      [req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const requestPasswordResetOtp = async (req, res) => {
  const { username, phone } = req.body;
  try {
    await ensurePasswordResetOtpTable();

    const [rows] = await pool.execute(
      'SELECT staff_id, phone FROM staff WHERE username = ? LIMIT 1',
      [username]
    );

    const user = rows[0];
    if (!user || normalizePhone(user.phone) !== normalizePhone(phone)) {
      return res.json({ success: true, data: { sent: true }, message: 'If the information is correct, an OTP has been sent' });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    await pool.execute(
      'UPDATE password_reset_otps SET used_at = NOW() WHERE staff_id = ? AND used_at IS NULL',
      [user.staff_id]
    );
    await pool.execute(
      'INSERT INTO password_reset_otps (staff_id, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [user.staff_id, otpHash]
    );

    if (process.env.NODE_ENV !== 'production' || process.env.RETURN_OTP_IN_RESPONSE === 'true') {
      return res.json({ success: true, data: { sent: true, dev_otp: otp }, message: 'OTP generated for development' });
    }

    // TODO: connect SMS/WhatsApp provider here for production OTP delivery.
    res.json({ success: true, data: { sent: true }, message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const confirmPasswordResetOtp = async (req, res) => {
  const { username, phone, otp, password } = req.body;

  if (!username || !phone || !otp || !password) {
    return res.status(400).json({ success: false, message: 'username, phone, otp and password are required' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  try {
    await ensurePasswordResetOtpTable();

    const [staffRows] = await pool.execute(
      'SELECT staff_id, phone FROM staff WHERE username = ? LIMIT 1',
      [username]
    );
    const user = staffRows[0];
    if (!user || normalizePhone(user.phone) !== normalizePhone(phone)) {
      return res.status(400).json({ success: false, message: 'OTP or account information is incorrect' });
    }

    const [otpRows] = await pool.execute(
      `SELECT otp_id, otp_hash, attempts
       FROM password_reset_otps
       WHERE staff_id = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.staff_id]
    );

    const otpRecord = otpRows[0];
    if (!otpRecord || otpRecord.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'OTP is invalid or expired' });
    }

    const validOtp = await bcrypt.compare(String(otp), otpRecord.otp_hash);
    if (!validOtp) {
      await pool.execute('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE otp_id = ?', [otpRecord.otp_id]);
      return res.status(400).json({ success: false, message: 'OTP is invalid or expired' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.execute('UPDATE staff SET password = ? WHERE staff_id = ?', [hashed, user.staff_id]);
    await pool.execute('UPDATE password_reset_otps SET used_at = NOW() WHERE otp_id = ?', [otpRecord.otp_id]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { login, me, requestPasswordResetOtp, confirmPasswordResetOtp };
