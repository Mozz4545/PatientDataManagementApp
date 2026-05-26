const mysql = require('mysql2/promise');
require('dotenv').config();

async function columnExists(connection, tableName, columnName) {
  const safeTable = tableName.replaceAll('`', '``');
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${safeTable}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (!(await columnExists(connection, tableName, columnName))) {
    await connection.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: false,
  });

  try {
    const dbName = (process.env.DB_NAME || 'radiology_db').replaceAll('`', '``');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS staff (
        staff_id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        staff_name VARCHAR(255) NOT NULL,
        role ENUM('ADMIN', 'STAFF') DEFAULT 'STAFF',
        position VARCHAR(100),
        department VARCHAR(100),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await addColumnIfMissing(connection, 'staff', 'department', 'VARCHAR(100) NULL');
    await addColumnIfMissing(connection, 'staff', 'phone', 'VARCHAR(20) NULL');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS patients (
        patient_id INT PRIMARY KEY AUTO_INCREMENT,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        age INT,
        gender ENUM('M', 'F', 'Other'),
        phone VARCHAR(20),
        date_of_birth DATE,
        address TEXT,
        emergency_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS exam_types (
        exam_type_id INT PRIMARY KEY AUTO_INCREMENT,
        exam_name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) DEFAULT 0
      )
    `);
    await addColumnIfMissing(connection, 'exam_types', 'price', 'DECIMAL(10, 2) DEFAULT 0');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`order\` (
        order_id INT PRIMARY KEY AUTO_INCREMENT,
        patient_id INT NOT NULL,
        exam_type_id INT NOT NULL,
        staff_id INT NOT NULL,
        order_date DATETIME NOT NULL,
        note TEXT,
        status VARCHAR(50) DEFAULT 'PENDING',
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
        FOREIGN KEY (exam_type_id) REFERENCES exam_types(exam_type_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS queue (
        queue_id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        queue_no INT NOT NULL,
        queue_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'WAITING',
        called_at DATETIME NULL,
        FOREIGN KEY (order_id) REFERENCES \`order\`(order_id)
      )
    `);
    await addColumnIfMissing(connection, 'queue', 'called_at', 'DATETIME NULL');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment (
        payment_id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        staff_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date DATETIME NOT NULL,
        payment_type VARCHAR(100) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES \`order\`(order_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS result (
        result_id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        staff_id INT NOT NULL,
        result_detail TEXT NOT NULL,
        result_date DATETIME NOT NULL,
        FOREIGN KEY (order_id) REFERENCES \`order\`(order_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
      )
    `);

    await connection.execute(`
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

    await connection.execute(
      'INSERT IGNORE INTO schema_migrations (migration_id) VALUES (?)',
      ['001_core_schema']
    );
    console.log('Database migration completed successfully.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.code || err.message || err);
  process.exit(1);
});
