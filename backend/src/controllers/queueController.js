const pool = require('../db/connection');
const { WAITING_STATUS, createQueueForOrder } = require('../services/queueService');

const CALLING_STATUS = 'ກຳລັງເອີ້ນ';
const IN_PROGRESS_STATUS = 'ກຳລັງກວດ';

const ensureQueueColumns = async () => {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue' AND COLUMN_NAME = 'called_at'`
  );
  if (!rows.length) {
    await pool.execute('ALTER TABLE queue ADD COLUMN called_at DATETIME NULL');
  }
};

const queueSelect = `
  SELECT q.*, o.exam_type_id, p.first_name, p.last_name, e.exam_name
  FROM queue q
  JOIN \`order\` o ON q.order_id = o.order_id
  JOIN patients p ON o.patient_id = p.patient_id
  JOIN exam_types e ON o.exam_type_id = e.exam_type_id
`;

const getQueues = async (req, res) => {
  try {
    await ensureQueueColumns();
    const { status, date } = req.query;
    let query = queueSelect;
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
  const connection = await pool.getConnection();
  try {
    await ensureQueueColumns();
    await connection.beginTransaction();
    const { order_id, queue_date } = req.body;

    const [orders] = await connection.execute(
      'SELECT order_id, status FROM `order` WHERE order_id = ? LIMIT 1',
      [order_id]
    );
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບໃບສັ່ງກວດນີ້' });
    }
    if (orders[0].status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ໃບສັ່ງກວດທີ່ຍົກເລີກແລ້ວບໍ່ສາມາດສ້າງຄິວໄດ້' });
    }

    const queue = await createQueueForOrder(connection, order_id, queue_date);
    await connection.commit();
    res.status(201).json({ success: true, data: queue });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
};

const updateQueueStatus = async (req, res) => {
  try {
    await ensureQueueColumns();
    const { status } = req.body;
    const [result] = await pool.execute(
      'UPDATE queue SET status=?, called_at = CASE WHEN ? = ? THEN NOW() ELSE called_at END WHERE queue_id=?',
      [status, status, CALLING_STATUS, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Queue not found' });
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getQueueById = async (queueId) => {
  const [rows] = await pool.execute(`${queueSelect} WHERE q.queue_id = ? LIMIT 1`, [queueId]);
  return rows[0] || null;
};

const callQueue = async (req, res) => {
  try {
    await ensureQueueColumns();
    const queue = await getQueueById(req.params.id);
    if (!queue) return res.status(404).json({ success: false, message: 'Queue not found' });

    await pool.execute(
      'UPDATE queue SET status=? WHERE queue_date=? AND status=? AND queue_id<>?',
      [IN_PROGRESS_STATUS, queue.queue_date, CALLING_STATUS, queue.queue_id]
    );
    await pool.execute('UPDATE queue SET status=?, called_at=NOW() WHERE queue_id=?', [CALLING_STATUS, queue.queue_id]);
    await pool.execute(
      'UPDATE `order` SET status=? WHERE order_id=? AND status NOT IN (?, ?)',
      ['IN_PROGRESS', queue.order_id, 'COMPLETED', 'DONE']
    );

    const calledQueue = await getQueueById(queue.queue_id);
    res.json({ success: true, data: calledQueue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const callNextQueue = async (req, res) => {
  try {
    await ensureQueueColumns();
    const date = req.query.date;
    const [rows] = await pool.execute(
      `${queueSelect}
       WHERE q.queue_date = ${date ? '?' : 'CURDATE()'} AND q.status IN (?, 'WAITING')
       ORDER BY q.queue_no ASC
       LIMIT 1`,
      date ? [date, WAITING_STATUS] : [WAITING_STATUS]
    );

    if (!rows.length) return res.json({ success: true, data: null, message: 'No waiting queue' });

    const queue = rows[0];
    await pool.execute(
      'UPDATE queue SET status=? WHERE queue_date=? AND status=? AND queue_id<>?',
      [IN_PROGRESS_STATUS, queue.queue_date, CALLING_STATUS, queue.queue_id]
    );
    await pool.execute('UPDATE queue SET status=?, called_at=NOW() WHERE queue_id=?', [CALLING_STATUS, queue.queue_id]);
    await pool.execute(
      'UPDATE `order` SET status=? WHERE order_id=? AND status NOT IN (?, ?)',
      ['IN_PROGRESS', queue.order_id, 'COMPLETED', 'DONE']
    );

    const calledQueue = await getQueueById(queue.queue_id);
    res.json({ success: true, data: calledQueue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCurrentCall = async (req, res) => {
  try {
    await ensureQueueColumns();
    const date = req.query.date;
    const [currentRows] = await pool.execute(
      `${queueSelect}
       WHERE q.queue_date = ${date ? '?' : 'CURDATE()'} AND q.called_at IS NOT NULL
       ORDER BY q.called_at DESC
       LIMIT 1`,
      date ? [date] : []
    );
    const [recentRows] = await pool.execute(
      `${queueSelect}
       WHERE q.queue_date = ${date ? '?' : 'CURDATE()'} AND q.called_at IS NOT NULL
       ORDER BY q.called_at DESC
       LIMIT 5`,
      date ? [date] : []
    );
    res.json({ success: true, data: { current: currentRows[0] || null, recent: recentRows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getQueues, createQueue, updateQueueStatus, callQueue, callNextQueue, getCurrentCall };
