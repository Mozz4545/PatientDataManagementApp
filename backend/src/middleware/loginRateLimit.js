const attempts = new Map();

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function loginRateLimit(req, res, next) {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${username || 'anonymous'}`;
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, resetAt: now + WINDOW_MS };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  record.count += 1;
  attempts.set(key, record);

  if (record.count > MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: 'ລອງເຂົ້າລະບົບຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ 1 ນາທີ',
    });
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      attempts.delete(key);
    }
  });

  next();
}

module.exports = loginRateLimit;
