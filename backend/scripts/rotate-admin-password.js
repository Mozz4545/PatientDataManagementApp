const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const username = String(process.env.ADMIN_USERNAME || 'admin').trim();
  const password = String(process.env.ADMIN_NEW_PASSWORD || '');
  if (password.length < 12) {
    throw new Error('ADMIN_NEW_PASSWORD must contain at least 12 characters');
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('ADMIN_NEW_PASSWORD must include upper/lowercase letters, a number, and a symbol');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await connection.execute(
      'UPDATE staff SET password=? WHERE username=? AND role=? AND is_active=1',
      [hashed, username, 'ADMIN']
    );
    if (result.affectedRows !== 1) throw new Error(`Active ADMIN account not found: ${username}`);
    console.log(`Password rotated for ADMIN account "${username}".`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
