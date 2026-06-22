const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const REQUIRED_TABLES = ['staff', 'patients', 'exam_types', 'order', 'queue', 'payment', 'result', 'audit_logs'];

const DEFAULT_EXAM_TYPES = [
  ['X-Ray Chest', 'Chest radiography', 150000],
  ['CT Abdomen', 'Computed tomography abdomen', 450000],
  ['MRI Brain', 'Magnetic resonance imaging brain', 650000],
  ['Ultrasound', 'Ultrasound examination', 200000],
];

async function seedDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: false,
  });

  try {
    const dbName = (process.env.DB_NAME || 'radiology_db').replaceAll('`', '``');
    await connection.query(`USE \`${dbName}\``);
    await assertMigrated(connection);

    const [examCountRows] = await connection.execute('SELECT COUNT(*) AS total FROM exam_types');
    if (Number(examCountRows[0].total) === 0) {
      await connection.query(
        'INSERT INTO exam_types (exam_name, description, price) VALUES ?',
        [DEFAULT_EXAM_TYPES]
      );
      console.log('Seeded default exam types.');
    } else {
      console.log('Exam types already exist. Skipping default exam types.');
    }

    const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    if (process.env.NODE_ENV === 'production' && (!process.env.SEED_ADMIN_PASSWORD || adminPassword === 'admin123')) {
      throw new Error('SEED_ADMIN_PASSWORD must be explicitly configured and must not use the development default');
    }
    const [adminRows] = await connection.execute(
      'SELECT staff_id FROM staff WHERE username = ? LIMIT 1',
      [adminUsername]
    );

    if (!adminRows.length) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await connection.execute(
        `INSERT INTO staff
          (username, password, staff_name, role, position, department, phone, is_active, deleted_at)
         VALUES (?, ?, ?, 'ADMIN', 'System Administrator', NULL, NULL, 1, NULL)`,
        [adminUsername, hashedPassword, 'Admin User']
      );
      console.log(`Seeded admin user: ${adminUsername} / ${adminPassword}`);
    } else {
      console.log(`Admin user "${adminUsername}" already exists. Skipping admin seed.`);
    }

    console.log('Database seed completed successfully.');
  } finally {
    await connection.end();
  }
}

async function assertMigrated(connection) {
  const placeholders = REQUIRED_TABLES.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    REQUIRED_TABLES
  );
  const existing = new Set(rows.map((row) => row.TABLE_NAME));
  const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));
  if (missing.length) {
    throw new Error(`Missing tables: ${missing.join(', ')}. Run "npm run migrate" before seed.`);
  }
}

seedDatabase().catch((err) => {
  console.error('Seed failed:', err.code || err.message || err);
  process.exit(1);
});
