const pool = require('../db/connection');

const getPayments = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT pay.*, p.first_name, p.last_name, e.exam_name, s.staff_name, o.status AS order_status
       FROM payment pay
       JOIN \`order\` o ON pay.order_id = o.order_id
       JOIN patients p ON o.patient_id = p.patient_id
       JOIN exam_types e ON o.exam_type_id = e.exam_type_id
       JOIN staff s ON pay.staff_id = s.staff_id
       ORDER BY pay.payment_date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createPayment = async (req, res) => {
  try {
    const { order_id, staff_id, amount, payment_date, payment_type } = req.body;
    if (!order_id || !staff_id || !amount || !payment_type) {
      return res.status(400).json({ success: false, message: 'order_id, staff_id, amount and payment_type are required' });
    }

    const [existing] = await pool.execute(
      'SELECT payment_id FROM payment WHERE order_id = ? LIMIT 1',
      [order_id]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'This order has already been paid' });
    }

    const [result] = await pool.execute(
      'INSERT INTO payment (order_id, staff_id, amount, payment_date, payment_type) VALUES (?, ?, ?, ?, ?)',
      [order_id, staff_id, amount, payment_date || new Date(), payment_type]
    );
    await pool.execute('UPDATE `order` SET status=? WHERE order_id=?', ['DONE', order_id]);
    res.status(201).json({ success: true, data: { payment_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSummary = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DATE(payment_date) as date, SUM(amount) as total, COUNT(*) as count
       FROM payment GROUP BY DATE(payment_date) ORDER BY date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPayments, createPayment, getSummary };
