const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    const dbName = (process.env.DB_NAME || 'radiology_db').replaceAll('`', '``');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    // สร้าง staff table
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

    const [staffColumns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'staff'
        AND COLUMN_NAME IN ('department', 'phone')
    `);
    const existingStaffColumns = new Set(staffColumns.map((column) => column.COLUMN_NAME));
    if (!existingStaffColumns.has('department')) {
      await connection.execute('ALTER TABLE staff ADD COLUMN department VARCHAR(100) NULL');
    }
    if (!existingStaffColumns.has('phone')) {
      await connection.execute('ALTER TABLE staff ADD COLUMN phone VARCHAR(20) NULL');
    }

    // สร้าง patients table
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
    const [queueColumns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'queue'
        AND COLUMN_NAME = 'called_at'
    `);
    if (!queueColumns.length) {
      await connection.execute('ALTER TABLE queue ADD COLUMN called_at DATETIME NULL');
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment (
        payment_id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        staff_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date DATETIME NOT NULL,
        payment_type VARCHAR(100) NOT NULL,
        UNIQUE KEY uq_payment_order (order_id),
        FOREIGN KEY (order_id) REFERENCES \`order\`(order_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
      )
    `);
    const [paymentIndexes] = await connection.execute(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'payment'
        AND INDEX_NAME = 'uq_payment_order'
    `);
    if (!paymentIndexes.length) {
      await connection.execute('ALTER TABLE payment ADD UNIQUE KEY uq_payment_order (order_id)');
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS result (
        result_id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        staff_id INT NOT NULL,
        result_detail TEXT NOT NULL,
        result_image_url VARCHAR(255) NULL,
        result_date DATETIME NOT NULL,
        FOREIGN KEY (order_id) REFERENCES \`order\`(order_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
      )
    `);
    const [resultImageColumns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'result'
        AND COLUMN_NAME = 'result_image_url'
    `);
    if (!resultImageColumns.length) {
      await connection.execute('ALTER TABLE result ADD COLUMN result_image_url VARCHAR(255) NULL');
    }

    const [examCountRows] = await connection.execute('SELECT COUNT(*) AS total FROM exam_types');
    if (Number(examCountRows[0].total) === 0) {
      await connection.execute(
        `INSERT INTO exam_types (exam_name, description, price) VALUES
          ('X-Ray Chest', 'Chest radiography', 150000),
          ('CT Abdomen', 'Computed tomography abdomen', 450000),
          ('MRI Brain', 'Magnetic resonance imaging brain', 650000),
          ('Ultrasound', 'Ultrasound examination', 200000)`
      );
    }

    // เพิ่ม test staff user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    try {
      await connection.execute(
        `INSERT INTO staff (username, password, staff_name, role, position) VALUES (?, ?, ?, ?, ?)`,
        ['admin', hashedPassword, 'Admin User', 'ADMIN', 'System Administrator']
      );
      console.log('✅ Staff user created: admin / admin123');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log('ℹ️  Staff user already exists');
      } else {
        throw err;
      }
    }

    await connection.end();
    console.log('✅ Database seeded successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedDatabase();
