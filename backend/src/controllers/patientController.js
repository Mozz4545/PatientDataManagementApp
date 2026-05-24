const pool = require('../db/connection');

// GET /api/patients — list + search
const getPatients = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM patients';
    let params = [];

    if (q) {
      query += ' WHERE first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ?';
      params = [`%${q}%`, `%${q}%`, `%${q}%`];
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/patients/:id — detail
const getPatientById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM patients WHERE patient_id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/patients — register
const createPatient = async (req, res) => {
  try {
    const { first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO patients 
        (first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone]
    );

    res.status(201).json({ 
      success: true, 
      data: { patient_id: result.insertId } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/patients/:id — update
const updatePatient = async (req, res) => {
  try {
    const { first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone } = req.body;

    const [result] = await pool.execute(
      `UPDATE patients SET 
        first_name = ?, last_name = ?, age = ?, gender = ?,
        phone = ?, date_of_birth = ?, address = ?, emergency_phone = ?
       WHERE patient_id = ?`,
      [first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/patients/:id
const deletePatient = async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM patients WHERE patient_id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPatients, getPatientById, createPatient, updatePatient, deletePatient };