const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config();

const TABLES = ['staff', 'patients', 'exam_types', 'order', 'queue', 'payment', 'result', 'audit_logs'];

const backendDir = path.resolve(__dirname, '..');
const backupsDir = path.join(backendDir, 'backups');
const uploadsDir = path.join(backendDir, 'uploads');

async function restore() {
  const backupArg = process.argv.find((arg, index) => index > 1 && arg !== '--yes');
  const confirmed = process.argv.includes('--yes');
  const skipUploads = process.argv.includes('--skip-uploads');

  if (!backupArg) {
    console.error('Usage: npm run restore -- <backup-folder-or-path> --yes [--skip-uploads]');
    process.exit(1);
  }

  if (!confirmed) {
    console.error('Restore will replace database rows and result images. Add --yes to confirm.');
    process.exit(1);
  }

  const backupDir = resolveBackupPath(backupArg);
  const databasePath = path.join(backupDir, 'database.json');
  const manifestPath = path.join(backupDir, 'manifest.json');

  if (!fs.existsSync(databasePath) || !fs.existsSync(manifestPath)) {
    throw new Error(`Invalid backup folder: ${backupDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const databaseJson = fs.readFileSync(databasePath, 'utf8');
  validateBackup(manifest, databaseJson, backupDir);
  const data = JSON.parse(databaseJson);
  const dbName = process.env.DB_NAME || 'radiology_db';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    multipleStatements: false,
  });

  try {
    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of [...TABLES].reverse()) {
      await connection.query(`DELETE FROM \`${escapeIdentifier(table)}\``);
    }

    for (const table of TABLES) {
      const rows = data[table] || [];
      for (const row of rows) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const columnList = columns.map((column) => `\`${escapeIdentifier(column)}\``).join(', ');
        const values = columns.map((column) => row[column]);
        await connection.query(
          `INSERT INTO \`${escapeIdentifier(table)}\` (${columnList}) VALUES (${placeholders})`,
          values
        );
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_restoreErr) {
      // Keep the original restore error as the visible failure.
    }
    throw err;
  } finally {
    await connection.end();
  }

  if (skipUploads) {
    console.log('Result image restore skipped by --skip-uploads.');
  } else {
    restoreUploads(backupDir);
  }
  console.log(`Restore completed from: ${backupDir}`);
}

function validateBackup(manifest, databaseJson, backupDir) {
  if (manifest.app !== 'radiology-patient-management') {
    throw new Error(`Backup belongs to an unexpected application: ${backupDir}`);
  }
  if (!manifest.tables || typeof manifest.tables !== 'object') {
    throw new Error(`Backup manifest does not contain table counts: ${backupDir}`);
  }
  for (const table of TABLES) {
    const count = manifest.tables[table] ?? (table === 'audit_logs' ? 0 : undefined);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Backup manifest has an invalid count for table "${table}"`);
    }
  }
  if (manifest.database_sha256) {
    const actualHash = crypto.createHash('sha256').update(databaseJson).digest('hex');
    if (actualHash !== manifest.database_sha256) {
      throw new Error('Backup database checksum does not match the manifest');
    }
  }
}

function restoreUploads(backupDir) {
  const backupUploadsDir = path.join(backupDir, 'uploads');
  const backupResultsDir = path.join(backupUploadsDir, 'results');
  const targetResultsDir = path.join(uploadsDir, 'results');

  if (!fs.existsSync(backupResultsDir)) {
    console.log('No result images found in backup. Database was restored only.');
    return;
  }

  assertPathInside(targetResultsDir, uploadsDir);
  fs.rmSync(targetResultsDir, { recursive: true, force: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.cpSync(backupResultsDir, targetResultsDir, { recursive: true, force: true });
}

function resolveBackupPath(input) {
  const directPath = path.resolve(process.cwd(), input);
  if (fs.existsSync(directPath)) return directPath;

  const namedPath = path.join(backupsDir, input);
  if (fs.existsSync(namedPath)) return namedPath;

  throw new Error(`Backup folder not found: ${input}`);
}

function assertPathInside(targetPath, parentPath) {
  const relative = path.relative(parentPath, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe restore path: ${targetPath}`);
  }
}

function escapeIdentifier(value) {
  return String(value).replaceAll('`', '``');
}

restore().catch((err) => {
  console.error('Restore failed:', err.code || err.message || err);
  process.exit(1);
});
