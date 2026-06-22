const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config();

const TABLES = [
  { name: 'staff', orderBy: 'staff_id' },
  { name: 'patients', orderBy: 'patient_id' },
  { name: 'exam_types', orderBy: 'exam_type_id' },
  { name: 'order', orderBy: 'order_id' },
  { name: 'queue', orderBy: 'queue_id' },
  { name: 'payment', orderBy: 'payment_id' },
  { name: 'result', orderBy: 'result_id' },
  { name: 'audit_logs', orderBy: 'audit_log_id' },
];

const backendDir = path.resolve(__dirname, '..');
const backupsDir = path.join(backendDir, 'backups');
const uploadsDir = path.join(backendDir, 'uploads');

async function backup() {
  const dbName = process.env.DB_NAME || 'radiology_db';
  const backupName = `backup-${formatTimestamp(new Date())}`;
  const outputDir = path.join(backupsDir, backupName);
  const data = {};
  const counts = {};

  fs.mkdirSync(outputDir, { recursive: true });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    multipleStatements: false,
  });

  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    for (const table of TABLES) {
      const [rows] = await connection.query(
        `SELECT * FROM \`${escapeIdentifier(table.name)}\` ORDER BY \`${escapeIdentifier(table.orderBy)}\` ASC`
      );
      data[table.name] = rows;
      counts[table.name] = rows.length;
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const manifest = {
    app: 'radiology-patient-management',
    database: dbName,
    created_at: new Date().toISOString(),
    tables: counts,
    uploads_included: fs.existsSync(uploadsDir),
  };

  const databaseJson = JSON.stringify(data, null, 2);
  manifest.database_sha256 = crypto.createHash('sha256').update(databaseJson).digest('hex');
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(outputDir, 'database.json'), databaseJson);

  if (fs.existsSync(uploadsDir)) {
    fs.cpSync(uploadsDir, path.join(outputDir, 'uploads'), { recursive: true, force: true });
  }

  console.log(`Backup completed: ${outputDir}`);
}

function escapeIdentifier(value) {
  return String(value).replaceAll('`', '``');
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

backup().catch((err) => {
  console.error('Backup failed:', err.code || err.message || err);
  process.exit(1);
});
