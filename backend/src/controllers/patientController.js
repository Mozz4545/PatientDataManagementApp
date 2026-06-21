const pool = require('../db/connection');
const { isAllowed, isPositiveInt, requiredString, sendServerError, toPositiveInt } = require('../utils/http');

// GET /api/patients — list + search
const getPatients = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const safePage = toPositiveInt(page, 1);
    const safeLimit = Math.min(toPositiveInt(limit, 10), 1000);
    const offset = (safePage - 1) * safeLimit;

    let query = 'SELECT * FROM patients WHERE is_active = 1';
    let params = [];

    if (q) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ? OR phone LIKE ?)';
      params = [`%${q}%`, `%${q}%`, `%${q}%`];
      params.push(`%${q}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, offset);

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    sendServerError(res, err);
  }
};

// GET /api/patients/:id — detail
const getPatientById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM patients WHERE patient_id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
};

function validatePatientPayload(payload) {
  const { first_name, last_name, age, gender } = payload;
  if (!requiredString(first_name)) return 'ກະລຸນາປ້ອນຊື່ຄົນເຈັບ';
  if (!requiredString(last_name)) return 'ກະລຸນາປ້ອນນາມສະກຸນຄົນເຈັບ';
  if (!isAllowed(gender, ['M', 'F', 'Other'])) return 'ເພດຄົນເຈັບບໍ່ຖືກຕ້ອງ';
  if (age !== undefined && age !== null && age !== '' && (!Number.isFinite(Number(age)) || Number(age) <= 0)) {
    return 'ອາຍຸຄົນເຈັບບໍ່ຖືກຕ້ອງ';
  }
  return null;
}

// POST /api/patients — register
const createPatient = async (req, res) => {
  try {
    const { first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone } = req.body;
    const validationMessage = validatePatientPayload(req.body);
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const [result] = await pool.execute(
      `INSERT INTO patients 
        (first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name.trim(), last_name.trim(), age || null, gender, phone || null, date_of_birth || null, address || null, emergency_phone || null]
    );

    res.status(201).json({ 
      success: true, 
      data: { patient_id: result.insertId } 
    });
  } catch (err) {
    sendServerError(res, err);
  }
};

// PUT /api/patients/:id — update
const updatePatient = async (req, res) => {
  try {
    const { first_name, last_name, age, gender, phone, date_of_birth, address, emergency_phone } = req.body;
    const patientId = Number(req.params.id);
    if (!isPositiveInt(patientId)) {
      return res.status(400).json({ success: false, message: 'ລະຫັດຄົນເຈັບບໍ່ຖືກຕ້ອງ' });
    }
    const validationMessage = validatePatientPayload(req.body);
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const [result] = await pool.execute(
      `UPDATE patients SET 
        first_name = ?, last_name = ?, age = ?, gender = ?,
        phone = ?, date_of_birth = ?, address = ?, emergency_phone = ?
       WHERE patient_id = ? AND is_active = 1`,
      [first_name.trim(), last_name.trim(), age || null, gender, phone || null, date_of_birth || null, address || null, emergency_phone || null, patientId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    sendServerError(res, err);
  }
};

// DELETE /api/patients/:id
const deletePatient = async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    if (!isPositiveInt(patientId)) {
      return res.status(400).json({ success: false, message: 'ລະຫັດຄົນເຈັບບໍ່ຖືກຕ້ອງ' });
    }

    const [result] = await pool.execute(
      'UPDATE patients SET is_active = 0, deleted_at = NOW() WHERE patient_id = ? AND is_active = 1',
      [patientId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, message: 'ລົບຄົນເຈັບອອກຈາກລາຍຊື່ສຳເລັດ' });
  } catch (err) {
    sendServerError(res, err);
  }
};

module.exports = { getPatients, getPatientById, createPatient, updatePatient, deletePatient };
