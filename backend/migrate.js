const mysql = require('mysql2/promise');
require('dotenv').config();

async function columnExists(connection, tableName, columnName) {
  const safeTable = tableName.replaceAll('`', '``');
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${safeTable}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (!(await columnExists(connection, tableName, columnName))) {
    const safeTable = tableName.replaceAll('`', '``');
    const safeColumn = columnName.replaceAll('`', '``');
    await connection.execute(`ALTER TABLE \`${safeTable}\` ADD COLUMN \`${safeColumn}\` ${definition}`);
  }
}

async function indexExists(connection, tableName, indexName) {
  const safeTable = tableName.replaceAll('`', '``');
  const [rows] = await connection.query(`SHOW INDEX FROM \`${safeTable}\` WHERE Key_name = ?`, [indexName]);
  return rows.length > 0;
}

async function addIndexIfMissing(connection, tableName, indexName, definition) {
  if (!(await indexExists(connection, tableName, indexName))) {
    const safeTable = tableName.replaceAll('`', '``');
    await connection.execute(`ALTER TABLE \`${safeTable}\` ADD ${definition}`);
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
        document_no VARCHAR(40) NULL,
        billing_no VARCHAR(40) NULL,
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
    await addColumnIfMissing(connection, 'order', 'document_no', 'VARCHAR(40) NULL');
    await addColumnIfMissing(connection, 'order', 'billing_no', 'VARCHAR(40) NULL');
    await connection.execute(`
      UPDATE \`order\`
      SET document_no = CONCAT('ORD-', DATE_FORMAT(order_date, '%Y%m%d'), '-', LPAD(order_id, 5, '0'))
      WHERE document_no IS NULL OR document_no = ''
    `);
    await connection.execute(`
      UPDATE \`order\`
      SET billing_no = CONCAT('BILL-', DATE_FORMAT(order_date, '%Y%m%d'), '-', LPAD(order_id, 5, '0'))
      WHERE billing_no IS NULL OR billing_no = ''
    `);
    await addIndexIfMissing(connection, 'order', 'uq_order_document_no', 'UNIQUE KEY uq_order_document_no (document_no)');
    await addIndexIfMissing(connection, 'order', 'uq_order_billing_no', 'UNIQUE KEY uq_order_billing_no (billing_no)');

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
        receipt_no VARCHAR(40) NULL,
        status VARCHAR(20) DEFAULT 'PAID',
        adjustment_reason TEXT NULL,
        adjusted_by INT NULL,
        adjusted_at DATETIME NULL,
        UNIQUE KEY uq_payment_order (order_id),
        FOREIGN KEY (order_id) REFERENCES \`order\`(order_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
        FOREIGN KEY (adjusted_by) REFERENCES staff(staff_id)
      )
    `);
    await addIndexIfMissing(connection, 'payment', 'uq_payment_order', 'UNIQUE KEY uq_payment_order (order_id)');
    await addColumnIfMissing(connection, 'payment', 'receipt_no', 'VARCHAR(40) NULL');
    await addColumnIfMissing(connection, 'payment', 'status', "VARCHAR(20) DEFAULT 'PAID'");
    await addColumnIfMissing(connection, 'payment', 'adjustment_reason', 'TEXT NULL');
    await addColumnIfMissing(connection, 'payment', 'adjusted_by', 'INT NULL');
    await addColumnIfMissing(connection, 'payment', 'adjusted_at', 'DATETIME NULL');
    await addIndexIfMissing(connection, 'payment', 'idx_payment_status', 'INDEX idx_payment_status (status)');
    await connection.execute(`
      UPDATE payment
      SET receipt_no = CONCAT('RCPT-', DATE_FORMAT(payment_date, '%Y%m%d'), '-', LPAD(payment_id, 5, '0'))
      WHERE receipt_no IS NULL OR receipt_no = ''
    `);
    await addIndexIfMissing(connection, 'payment', 'uq_payment_receipt_no', 'UNIQUE KEY uq_payment_receipt_no (receipt_no)');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS result (
        result_id INT PRIMARY KEY AUTO_INCREMENT,
        report_no VARCHAR(40) NULL,
        order_id INT NOT NULL,
        staff_id INT NOT NULL,
        result_detail TEXT NOT NULL,
        result_image_url VARCHAR(255) NULL,
        result_date DATETIME NOT NULL,
        FOREIGN KEY (order_id) REFERENCES \`order\`(order_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
      )
    `);
    await addColumnIfMissing(connection, 'result', 'report_no', 'VARCHAR(40) NULL');
    await addColumnIfMissing(connection, 'result', 'result_image_url', 'VARCHAR(255) NULL');
    await connection.execute(`
      UPDATE result
      SET report_no = CONCAT('XR-', DATE_FORMAT(result_date, '%Y%m%d'), '-', LPAD(result_id, 5, '0'))
      WHERE report_no IS NULL OR report_no = ''
    `);
    await addIndexIfMissing(connection, 'result', 'uq_result_report_no', 'UNIQUE KEY uq_result_report_no (report_no)');

    const [resultImagesTable] = await connection.query("SHOW TABLES LIKE 'result_images'");
    if (resultImagesTable.length) {
      await connection.execute(`
        UPDATE result r
        JOIN (
          SELECT result_id, MIN(image_id) AS first_image_id
          FROM result_images
          GROUP BY result_id
        ) first_image ON first_image.result_id = r.result_id
        JOIN result_images ri ON ri.image_id = first_image.first_image_id
        SET r.result_image_url = ri.image_url
        WHERE r.result_image_url IS NULL OR r.result_image_url = ''
      `);
      await connection.execute('DROP TABLE result_images');
    }

    await connection.execute('DROP TABLE IF EXISTS audit_logs');
    await connection.execute('DROP TABLE IF EXISTS password_reset_otps');
    await connection.execute('DROP TABLE IF EXISTS schema_migrations');
    console.log('Database migration completed successfully.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.code || err.message || err);
  process.exit(1);
});
