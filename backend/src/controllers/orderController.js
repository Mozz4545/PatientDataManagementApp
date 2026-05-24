const pool = require('../db/connection');

// GET /api/orders
const getOrders = async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = `
      SELECT o.*, p.first_name, p.last_name, e.exam_name, s.staff_name
      FROM \`order\` o
      JOIN patients p ON o.patient_id = p.patient_id
      JOIN exam_types e ON o.exam_type_id = e.exam_type_id
      JOIN staff s ON o.staff_id = s.staff_id
    `;
    const params = [];
    const conditions = [];

    if (status) { conditions.push('o.status = ?'); params.push(status); }
    if (date)   { conditions.push('o.order_date = ?'); params.push(date); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY o.order_date DESC';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT o.*, p.first_name, p.last_name, e.exam_name, s.staff_name
       FROM \`order\` o
       JOIN patients p ON o.patient_id = p.patient_id
       JOIN exam_types e ON o.exam_type_id = e.exam_type_id
       JOIN staff s ON o.staff_id = s.staff_id
       WHERE o.order_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/orders
const createOrder = async (req, res) => {
  try {
    const { patient_id, exam_type_id, staff_id, order_date, note } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO `order` (patient_id, exam_type_id, staff_id, order_date, note) VALUES (?, ?, ?, ?, ?)',
      [patient_id, exam_type_id, staff_id, order_date, note || null]
    );
    res.status(201).json({ success: true, data: { order_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const [result] = await pool.execute(
      'UPDATE `order` SET status=? WHERE order_id=?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getOrders, getOrderById, createOrder, updateOrderStatus };