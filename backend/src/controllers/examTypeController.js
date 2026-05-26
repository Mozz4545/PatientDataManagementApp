const pool = require('../db/connection');

const getExamTypes = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT exam_type_id, exam_name, description, price FROM exam_types ORDER BY exam_type_id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createExamType = async (req, res) => {
  try {
    const { exam_name, description, price } = req.body;
    if (!exam_name) return res.status(400).json({ success: false, message: 'exam_name is required' });
    const [result] = await pool.execute(
      'INSERT INTO exam_types (exam_name, description, price) VALUES (?, ?, ?)',
      [exam_name, description || null, price || 0]
    );
    res.status(201).json({ success: true, data: { exam_type_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateExamType = async (req, res) => {
  try {
    const { exam_name, description, price } = req.body;
    if (!exam_name) return res.status(400).json({ success: false, message: 'exam_name is required' });
    const [result] = await pool.execute(
      'UPDATE exam_types SET exam_name=?, description=?, price=? WHERE exam_type_id=?',
      [exam_name, description || null, price || 0, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Exam type not found' });
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getExamTypes, createExamType, updateExamType };
