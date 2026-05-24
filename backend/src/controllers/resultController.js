const pool = require('../db/connection');

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
    const [result] = await pool.execute(
      'INSERT INTO result (order_id, staff_id, result_detail, result_date) VALUES (?, ?, ?, ?)',
      [order_id, staff_id, result_detail, result_date]
    );
    res.status(201).json({ success: true, data: { result_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateResult = async (req, res) => {
  try {
    const { result_detail } = req.body;
    await pool.execute(
      'UPDATE result SET result_detail=? WHERE result_id=?',
      [result_detail, req.params.id]
    );
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getResultByOrder, createResult, updateResult };