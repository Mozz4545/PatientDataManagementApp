const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // สร้าง staff table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS staff (
        staff_id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        staff_name VARCHAR(255) NOT NULL,
        role ENUM('ADMIN', 'STAFF') DEFAULT 'STAFF',
        position VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
