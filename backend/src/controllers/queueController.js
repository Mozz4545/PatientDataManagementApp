const pool = require('../db/connection');

const getQueues = async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = `
      SELECT q.*, o.exam_type_id, p.first_name, p.last_name, e.exam_name
      FROM queue q
      JOIN \`order\` o ON q.order_id = o.order_id
      JOIN patients p ON o.patient_id = p.patient_id
      JOIN exam_types e ON o.exam_type_id = e.exam_type_id
    `;
    const params = [];
    const conditions = [];

    if (status) { conditions.push('q.status = ?'); params.push(status); }
    if (date)   { conditions.push('q.queue_date = ?'); params.push(date); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY q.queue_no ASC';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createQueue = async (req, res) => {
  try {
    const { order_id, queue_date } = req.body;
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM queue WHERE queue_date = ?',
      [queue_date]
    );
    const queue_no = countRows[0].count + 1;

    const [result] = await pool.execute(
      'INSERT INTO queue (order_id, queue_no, queue_date) VALUES (?, ?, ?)',
      [order_id, queue_no, queue_date]
    );
    res.status(201).json({ success: true, data: { queue_id: result.insertId, queue_no } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateQueueStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const [result] = await pool.execute(
      'UPDATE queue SET status=? WHERE queue_id=?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Queue not found' });
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getQueues, createQueue, updateQueueStatus };
