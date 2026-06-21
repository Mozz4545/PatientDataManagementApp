const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

const authGuard = async (req, res, next) => {
  const cookieToken = parseCookies(req.headers.cookie).radiology_session;
  const token = cookieToken;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized' 
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT staff_id, username, role FROM staff WHERE staff_id = ? AND is_active = 1 LIMIT 1',
      [payload.id]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'ບັນຊີນີ້ບໍ່ສາມາດນຳໃຊ້ໄດ້' });
    }
    req.user = { id: rows[0].staff_id, username: rows[0].username, role: rows[0].role };
    next();
  } catch (error) {
    if (error?.name !== 'JsonWebTokenError' && error?.name !== 'TokenExpiredError') {
      console.error(error);
    }
    res.status(401).json({
      success: false, 
      message: 'ເຊດຊັນບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸ'
    });
  }
};

module.exports = authGuard;

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}
