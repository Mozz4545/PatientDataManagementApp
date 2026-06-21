const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config();

const TABLES = ['staff', 'patients', 'exam_types', 'order', 'queue', 'payment', 'result'];

async function main() {
  const backupDir = path.resolve(process.argv[2] || '');
  if (!backupDir || !fs.existsSync(backupDir)) throw new Error('Backup directory is required');

  const databasePath = path.join(backupDir, 'database.json');
  const manifestPath = path.join(backupDir, 'manifest.json');
  const databaseJson = fs.readFileSync(databasePath, 'utf8');
  const backupData = JSON.parse(databaseJson);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const hash = crypto.createHash('sha256').update(databaseJson).digest('hex');
  if (manifest.database_sha256 && hash !== manifest.database_sha256) throw new Error('Backup checksum mismatch');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const counts = {};
  try {
    for (const table of TABLES) {
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      counts[table] = rows.length;
      if (rows.length !== (backupData[table] || []).length) {
        throw new Error(`Row count mismatch for ${table}: restored=${rows.length}, backup=${(backupData[table] || []).length}`);
      }
    }

    const orphanQueries = {
      order_patient: 'SELECT COUNT(*) count FROM `order` o LEFT JOIN patients p ON p.patient_id=o.patient_id WHERE p.patient_id IS NULL',
      order_exam: 'SELECT COUNT(*) count FROM `order` o LEFT JOIN exam_types e ON e.exam_type_id=o.exam_type_id WHERE e.exam_type_id IS NULL',
      order_staff: 'SELECT COUNT(*) count FROM `order` o LEFT JOIN staff s ON s.staff_id=o.staff_id WHERE s.staff_id IS NULL',
      queue_order: 'SELECT COUNT(*) count FROM queue q LEFT JOIN `order` o ON o.order_id=q.order_id WHERE o.order_id IS NULL',
      payment_order: 'SELECT COUNT(*) count FROM payment p LEFT JOIN `order` o ON o.order_id=p.order_id WHERE o.order_id IS NULL',
      payment_staff: 'SELECT COUNT(*) count FROM payment p LEFT JOIN staff s ON s.staff_id=p.staff_id WHERE s.staff_id IS NULL',
      result_order: 'SELECT COUNT(*) count FROM result r LEFT JOIN `order` o ON o.order_id=r.order_id WHERE o.order_id IS NULL',
      result_staff: 'SELECT COUNT(*) count FROM result r LEFT JOIN staff s ON s.staff_id=r.staff_id WHERE s.staff_id IS NULL',
    };
    for (const [name, query] of Object.entries(orphanQueries)) {
      const [rows] = await connection.query(query);
      if (Number(rows[0].count) !== 0) throw new Error(`Orphan relationship found: ${name}`);
    }
  } finally {
    await connection.end();
  }

  const missingImages = (backupData.result || [])
    .filter((row) => row.result_image_url)
    .filter((row) => !fs.existsSync(path.join(backupDir, 'uploads', 'results', path.basename(row.result_image_url))))
    .map((row) => row.result_image_url);
  if (missingImages.length) throw new Error(`Missing result images in backup: ${missingImages.join(', ')}`);

  console.log(JSON.stringify({ verified: true, counts, missingImages: 0 }, null, 2));
}

main().catch((error) => {
  console.error('Restore verification failed:', error?.message || error?.code || error);
  process.exit(1);
});
