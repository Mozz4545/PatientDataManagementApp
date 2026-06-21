const crypto = require('crypto');

const insecureJwtSecrets = new Set([
  'radiology_secret_key_2025',
  'change-me',
  'secret',
  'your-secret-key',
]);

function loadSecurityConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = String(process.env.JWT_SECRET || '');
  const frontendOrigins = String(process.env.FRONTEND_URL || (isProduction ? '' : 'http://localhost:3000'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (jwtSecret.length < (isProduction ? 48 : 24)) {
    throw new Error(`JWT_SECRET must contain at least ${isProduction ? 48 : 24} characters`);
  }
  if (isProduction && insecureJwtSecrets.has(jwtSecret.toLowerCase())) {
    throw new Error('JWT_SECRET uses a known development value');
  }
  if (isProduction && !process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD is required in production');
  }
  if (!frontendOrigins.length) {
    throw new Error('FRONTEND_URL must contain at least one allowed origin');
  }

  for (const origin of frontendOrigins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`FRONTEND_URL contains an invalid origin: ${origin}`);
    }
    if (isProduction && url.protocol !== 'https:') {
      throw new Error(`Production FRONTEND_URL must use HTTPS: ${origin}`);
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`FRONTEND_URL must be an origin without path/query: ${origin}`);
    }
  }

  return {
    isProduction,
    frontendOrigins,
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    enforceHttps: isProduction && process.env.ENFORCE_HTTPS !== 'false',
  };
}

function parseTrustProxy(value) {
  if (!value) return false;
  if (value === 'true') return 1;
  if (value === 'false') return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : value;
}

function generateSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { loadSecurityConfig, generateSecret };
