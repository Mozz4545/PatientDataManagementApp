const pool = require('../db/connection');
const { WAITING_STATUS, createQueueForOrder } = require('../services/queueService');
const { isPositiveInt, sendServerError } = require('../utils/http');

const CALLING_STATUS = 'ກຳລັງເອີ້ນ';
const IN_PROGRESS_STATUS = 'ກຳລັງກວດ';
const NO_NEXT_QUEUE_MESSAGE = 'ຍັງບໍ່ມີຄິວຕໍ່ໄປ';

const queueSelect = `
  SELECT q.queue_id, q.order_id, q.queue_no, q.queue_date, q.called_at,
         CASE
           WHEN o.status IN ('CANCELLED', 'ຍົກເລີກແລ້ວ') THEN 'ຍົກເລີກແລ້ວ'
           WHEN r.result_id IS NOT NULL OR o.status = 'COMPLETED' THEN 'ສຳເລັດ'
           WHEN q.status IN ('ກຳລັງເອີ້ນ', 'CALLING') THEN 'ກຳລັງເອີ້ນ'
           WHEN o.status IN ('IN_PROGRESS', 'ກຳລັງກວດ')
             OR q.status IN ('ກຳລັງກວດ', 'IN_PROGRESS') THEN 'ກຳລັງກວດ'
           ELSE q.status
         END AS status,
         o.exam_type_id, p.first_name, p.last_name, e.exam_name
  FROM queue q
  JOIN \`order\` o ON q.order_id = o.order_id
  JOIN patients p ON o.patient_id = p.patient_id
  JOIN exam_types e ON o.exam_type_id = e.exam_type_id
  LEFT JOIN result r ON r.order_id = o.order_id
`;

const getQueues = async (req, res) => {
  try {
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
    sendServerError(res, err);
  }
};

const createQueue = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { order_id, queue_date } = req.body;
    if (!isPositiveInt(order_id)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ລະຫັດໃບສັ່ງກວດບໍ່ຖືກຕ້ອງ' });
    }

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
    sendServerError(res, err);
  } finally {
    connection.release();
  }
};

const updateQueueStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ກຳລັງລໍຖ້າ', 'ກຳລັງເອີ້ນ', 'ກຳລັງກວດ', 'WAITING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'ສະຖານະຄິວບໍ່ຖືກຕ້ອງ' });
    }
    const [result] = await pool.execute(
      'UPDATE queue SET status=?, called_at = CASE WHEN ? = ? THEN NOW() ELSE called_at END WHERE queue_id=?',
      [status, status, CALLING_STATUS, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Queue not found' });
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    sendServerError(res, err);
  }
};

const getQueueById = async (queueId) => {
  const [rows] = await pool.execute(`${queueSelect} WHERE q.queue_id = ? LIMIT 1`, [queueId]);
  return rows[0] || null;
};

const callQueue = async (req, res) => {
  try {
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
    sendServerError(res, err);
  }
};

const callNextQueue = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [dateRows] = await connection.execute('SELECT COALESCE(?, CURDATE()) AS queue_date', [req.query.date || null]);
    const targetDate = dateRows[0].queue_date;

    const [rows] = await connection.execute(
      `SELECT q.queue_id, q.order_id, q.queue_no, q.queue_date, q.status
       FROM queue q
       JOIN \`order\` o ON q.order_id = o.order_id
       WHERE q.queue_date = ?
         AND q.status IN (?, 'WAITING')
         AND o.status NOT IN ('CANCELLED', 'COMPLETED', 'DONE')
       ORDER BY q.queue_no ASC
       LIMIT 1
       FOR UPDATE`,
      [targetDate, WAITING_STATUS]
    );

    if (!rows.length) {
      await connection.commit();
      return res.json({ success: true, data: null, message: NO_NEXT_QUEUE_MESSAGE });
    }

    const queue = rows[0];
    await connection.execute(
      'UPDATE queue SET status=? WHERE queue_date=? AND status=? AND queue_id<>?',
      [IN_PROGRESS_STATUS, queue.queue_date, CALLING_STATUS, queue.queue_id]
    );
    await connection.execute('UPDATE queue SET status=?, called_at=NOW() WHERE queue_id=?', [CALLING_STATUS, queue.queue_id]);
    await connection.execute(
      'UPDATE `order` SET status=? WHERE order_id=? AND status NOT IN (?, ?)',
      ['IN_PROGRESS', queue.order_id, 'COMPLETED', 'DONE']
    );
    await connection.commit();

    const calledQueue = await getQueueById(queue.queue_id);
    res.json({ success: true, data: calledQueue, message: 'ເອີ້ນຄິວຖັດໄປສຳເລັດ' });
  } catch (err) {
    await connection.rollback();
    sendServerError(res, err);
  } finally {
    connection.release();
  }
};

const getCurrentCall = async (req, res) => {
  try {
    const date = req.query.date;
    const [currentRows] = await pool.execute(
      `${queueSelect}
       WHERE q.queue_date = ${date ? '?' : 'CURDATE()'}
         AND q.called_at IS NOT NULL
         AND q.status IN (?, 'CALLING')
       ORDER BY q.called_at DESC
       LIMIT 1`,
      date ? [date, CALLING_STATUS] : [CALLING_STATUS]
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
    sendServerError(res, err);
  }
};

module.exports = { getQueues, createQueue, updateQueueStatus, callQueue, callNextQueue, getCurrentCall };
