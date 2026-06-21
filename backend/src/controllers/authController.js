const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requiredString } = require('../utils/http');

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!requiredString(username) || !requiredString(password)) {
      return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM staff WHERE username = ? AND is_active = 1',
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ',
      });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ',
      });
    }

    const token = jwt.sign(
      { id: user.staff_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    setSessionCookie(res, token);
    res.json({
      success: true,
      data: {
        user: {
          id: user.staff_id,
          name: user.staff_name,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(503).json({ success: false, message: 'ບໍ່ສາມາດເຊື່ອມຕໍ່ລະບົບໄດ້ ກະລຸນາລອງໃໝ່' });
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT staff_id, username, staff_name, role, position FROM staff WHERE staff_id = ? AND is_active = 1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
};

const logout = async (_req, res) => {
  res.setHeader('Set-Cookie', serializeSessionCookie('', 0));
  res.json({ success: true, message: 'ອອກຈາກລະບົບສຳເລັດ' });
};

module.exports = { login, me, logout };

function setSessionCookie(res, token) {
  const maxAge = parseExpiryToSeconds(process.env.JWT_EXPIRES_IN || '8h');
  res.setHeader('Set-Cookie', serializeSessionCookie(token, maxAge));
}

function serializeSessionCookie(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `radiology_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function parseExpiryToSeconds(value) {
  const match = String(value).trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return 8 * 60 * 60;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplier = unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
  return amount * multiplier;
}
