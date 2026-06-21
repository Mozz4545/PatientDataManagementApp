const pool = require('../db/connection');
const { requiredString, sendServerError } = require('../utils/http');

const getExamTypes = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT exam_type_id, exam_name, description, price, is_active, deleted_at FROM exam_types WHERE is_active = 1 ORDER BY exam_type_id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    sendServerError(res, err);
  }
};

const createExamType = async (req, res) => {
  try {
    const { exam_name, description, price } = req.body;
    const validationMessage = validateExamTypePayload({ exam_name, price });
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });
    const [result] = await pool.execute(
      'INSERT INTO exam_types (exam_name, description, price, is_active, deleted_at) VALUES (?, ?, ?, 1, NULL)',
      [exam_name.trim(), description || null, Number(price || 0)]
    );
    res.status(201).json({ success: true, data: { exam_type_id: result.insertId } });
  } catch (err) {
    sendServerError(res, err);
  }
};

const updateExamType = async (req, res) => {
  try {
    const { exam_name, description, price } = req.body;
    const validationMessage = validateExamTypePayload({ exam_name, price });
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });
    const [result] = await pool.execute(
      'UPDATE exam_types SET exam_name=?, description=?, price=? WHERE exam_type_id=? AND is_active = 1',
      [exam_name.trim(), description || null, Number(price || 0), req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Exam type not found' });
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    sendServerError(res, err);
  }
};

const deleteExamType = async (req, res) => {
  try {
    const examTypeId = Number(req.params.id);
    if (!examTypeId) {
      return res.status(400).json({ success: false, message: 'ລະຫັດປະເພດການກວດບໍ່ຖືກຕ້ອງ' });
    }

    const [rows] = await pool.execute('SELECT exam_type_id, is_active FROM exam_types WHERE exam_type_id = ? LIMIT 1', [examTypeId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບປະເພດການກວດນີ້' });
    }

    if (Number(rows[0].is_active) === 0) {
      return res.json({ success: true, message: 'ປະເພດການກວດນີ້ຖືກລົບອອກຈາກລາຍຊື່ແລ້ວ' });
    }

    await pool.execute('UPDATE exam_types SET is_active = 0, deleted_at = NOW() WHERE exam_type_id = ?', [examTypeId]);
    res.json({ success: true, message: 'ລົບປະເພດການກວດອອກຈາກລາຍຊື່ສຳເລັດ' });
  } catch (err) {
    sendServerError(res, err);
  }
};

module.exports = { getExamTypes, createExamType, updateExamType, deleteExamType };

function validateExamTypePayload({ exam_name, price }) {
  if (!requiredString(exam_name)) return 'ກະລຸນາປ້ອນຊື່ປະເພດການກວດ';
  const amount = Number(price || 0);
  if (!Number.isFinite(amount) || amount < 0) return 'ລາຄາຕ້ອງບໍ່ຕິດລົບ';
  return null;
}
