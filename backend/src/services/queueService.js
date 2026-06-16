const WAITING_STATUS = 'ກຳລັງລໍຖ້າ';

async function resolveQueueDate(connection, queueDate) {
  if (queueDate) return queueDate;
  const [rows] = await connection.execute('SELECT CURDATE() AS queue_date');
  return rows[0].queue_date;
}

async function createQueueForOrder(connection, orderId, queueDate) {
  const normalizedDate = await resolveQueueDate(connection, queueDate);

  const [existingRows] = await connection.execute(
    'SELECT queue_id, queue_no, queue_date, status FROM queue WHERE order_id = ? LIMIT 1',
    [orderId]
  );
  if (existingRows.length) return existingRows[0];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [latestRows] = await connection.execute(
      'SELECT queue_no FROM queue WHERE queue_date = ? ORDER BY queue_no DESC LIMIT 1 FOR UPDATE',
      [normalizedDate]
    );
    const queueNo = Number(latestRows[0]?.queue_no || 0) + 1;

    try {
      const [result] = await connection.execute(
        'INSERT INTO queue (order_id, queue_no, queue_date, status) VALUES (?, ?, ?, ?)',
        [orderId, queueNo, normalizedDate, WAITING_STATUS]
      );
      return {
        queue_id: result.insertId,
        order_id: orderId,
        queue_no: queueNo,
        queue_date: normalizedDate,
        status: WAITING_STATUS,
      };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      const [duplicateOrderRows] = await connection.execute(
        'SELECT queue_id, queue_no, queue_date, status FROM queue WHERE order_id = ? LIMIT 1',
        [orderId]
      );
      if (duplicateOrderRows.length) return duplicateOrderRows[0];
    }
  }

  throw new Error('Unable to create queue number');
}

module.exports = {
  WAITING_STATUS,
  createQueueForOrder,
};
