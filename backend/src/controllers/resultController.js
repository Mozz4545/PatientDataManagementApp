const pool = require('../db/connection');

const getResults = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, s.staff_name, o.order_date, o.status AS order_status,
              p.first_name, p.last_name, e.exam_name
       FROM result r
       JOIN staff s ON r.staff_id = s.staff_id
       JOIN \`order\` o ON r.order_id = o.order_id
       JOIN patients p ON o.patient_id = p.patient_id
       JOIN exam_types e ON o.exam_type_id = e.exam_type_id
       ORDER BY r.result_date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getResultByOrder = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, s.staff_name FROM result r
       JOIN staff s ON r.staff_id = s.staff_id
       WHERE r.order_id = ?`,
      [req.params.orderId]
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createResult = async (req, res) => {
  try {
    const { order_id, staff_id, result_detail, result_date } = req.body;
    if (!order_id || !staff_id || !result_detail) {
      return res.status(400).json({ success: false, message: 'order_id, staff_id and result_detail are required' });
    }
    const [existing] = await pool.execute('SELECT result_id FROM result WHERE order_id = ? LIMIT 1', [order_id]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Result already exists for this order' });
    }
    const [result] = await pool.execute(
      'INSERT INTO result (order_id, staff_id, result_detail, result_date) VALUES (?, ?, ?, ?)',
      [order_id, staff_id, result_detail, result_date || new Date()]
    );
    await pool.execute('UPDATE `order` SET status=? WHERE order_id=? AND status <> ?', ['COMPLETED', order_id, 'DONE']);
    res.status(201).json({ success: true, data: { result_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateResult = async (req, res) => {
  try {
    const { result_detail } = req.body;
    const [result] = await pool.execute(
      'UPDATE result SET result_detail=? WHERE result_id=?',
      [result_detail, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Result not found' });
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getResults, getResultByOrder, createResult, updateResult };
