const pool = require('../db/connection');

const ensureExamTypeColumns = async () => {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_types' AND COLUMN_NAME IN ('is_active', 'deleted_at')`
  );
  const existing = new Set(rows.map((row) => row.COLUMN_NAME));
  if (!existing.has('is_active')) {
    await pool.execute('ALTER TABLE exam_types ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
  }
  if (!existing.has('deleted_at')) {
    await pool.execute('ALTER TABLE exam_types ADD COLUMN deleted_at DATETIME NULL');
  }
};

const getExamTypes = async (req, res) => {
  try {
    await ensureExamTypeColumns();
    const [rows] = await pool.execute(
      'SELECT exam_type_id, exam_name, description, price, is_active, deleted_at FROM exam_types WHERE is_active = 1 ORDER BY exam_type_id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createExamType = async (req, res) => {
  try {
    await ensureExamTypeColumns();
    const { exam_name, description, price } = req.body;
    if (!exam_name) return res.status(400).json({ success: false, message: 'exam_name is required' });
    const [result] = await pool.execute(
      'INSERT INTO exam_types (exam_name, description, price, is_active, deleted_at) VALUES (?, ?, ?, 1, NULL)',
      [exam_name, description || null, price || 0]
    );
    res.status(201).json({ success: true, data: { exam_type_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateExamType = async (req, res) => {
  try {
    await ensureExamTypeColumns();
    const { exam_name, description, price } = req.body;
    if (!exam_name) return res.status(400).json({ success: false, message: 'exam_name is required' });
    const [result] = await pool.execute(
      'UPDATE exam_types SET exam_name=?, description=?, price=? WHERE exam_type_id=? AND is_active = 1',
      [exam_name, description || null, price || 0, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Exam type not found' });
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteExamType = async (req, res) => {
  try {
    await ensureExamTypeColumns();
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
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getExamTypes, createExamType, updateExamType, deleteExamType };
