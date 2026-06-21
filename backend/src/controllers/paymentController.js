const pool = require('../db/connection');
const { isPositiveInt, sendServerError } = require('../utils/http');

const getPayments = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT pay.*, COALESCE(pay.status, 'PAID') AS status,
              p.first_name, p.last_name, e.exam_name, e.price AS exam_price, s.staff_name, o.status AS order_status
       FROM payment pay
       JOIN \`order\` o ON pay.order_id = o.order_id
       JOIN patients p ON o.patient_id = p.patient_id
       JOIN exam_types e ON o.exam_type_id = e.exam_type_id
       JOIN staff s ON pay.staff_id = s.staff_id
       ORDER BY pay.payment_date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    sendServerError(res, err);
  }
};

const createPayment = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { order_id, staff_id, payment_type } = req.body;
    const staffId = Number(staff_id || req.user?.id);
    if (!isPositiveInt(order_id) || !isPositiveInt(staffId) || !payment_type) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ກະລຸນາລະບຸໃບສັ່ງກວດ, ຜູ້ຮັບເງິນ ແລະ ຊ່ອງທາງຊຳລະ' });
    }
    const allowedPaymentTypes = ['ເງິນສົດ', 'ເງິນໂອນ'];
    if (!allowedPaymentTypes.includes(payment_type)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ຊ່ອງທາງຊຳລະຕ້ອງເປັນ ເງິນສົດ ຫຼື ເງິນໂອນ' });
    }

    const [staffRows] = await connection.execute(
      'SELECT staff_id FROM staff WHERE staff_id = ? LIMIT 1',
      [staffId]
    );
    if (!staffRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ບໍ່ພົບຜູ້ຮັບເງິນນີ້' });
    }

    const [orders] = await connection.execute(
      `SELECT o.order_id, o.status, e.price AS exam_price, r.result_id
       FROM \`order\` o
       JOIN exam_types e ON o.exam_type_id = e.exam_type_id
       LEFT JOIN result r ON r.order_id = o.order_id
       WHERE o.order_id = ?
       LIMIT 1`,
      [order_id]
    );
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບໃບສັ່ງກວດນີ້' });
    }

    const order = orders[0];
    if (order.status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ໃບສັ່ງກວດທີ່ຍົກເລີກແລ້ວບໍ່ສາມາດຊຳລະໄດ້' });
    }
    if (!order.result_id && order.status !== 'COMPLETED') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ຕ້ອງບັນທຶກຜົນກວດກ່ອນຈຶ່ງຊຳລະເງິນໄດ້' });
    }

    const [existing] = await connection.execute(
      'SELECT * FROM payment WHERE order_id = ? LIMIT 1',
      [order_id]
    );
    if (existing.length && (existing[0].status || 'PAID') === 'PAID') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'ໃບສັ່ງກວດນີ້ຊຳລະເງິນແລ້ວ' });
    }

    const amount = Number(order.exam_price);
    if (!Number.isFinite(amount) || amount <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ລາຄາການກວດຂອງໃບສັ່ງກວດບໍ່ຖືກຕ້ອງ' });
    }

    const paidAt = new Date();
    let paymentId;
    if (existing.length) {
      paymentId = existing[0].payment_id;
      await connection.execute(
        `UPDATE payment
         SET staff_id=?, amount=?, payment_date=?, payment_type=?, status='PAID',
             receipt_no=COALESCE(NULLIF(receipt_no, ''), ?),
             adjustment_reason=NULL, adjusted_by=NULL, adjusted_at=NULL
         WHERE payment_id=?`,
        [staffId, amount, paidAt, payment_type, buildReceiptNo(paymentId, paidAt), paymentId]
      );
    } else {
      const [result] = await connection.execute(
        'INSERT INTO payment (order_id, staff_id, amount, payment_date, payment_type, status) VALUES (?, ?, ?, ?, ?, ?)',
        [order_id, staffId, amount, paidAt, payment_type, 'PAID']
      );
      paymentId = result.insertId;
      const receiptNo = buildReceiptNo(paymentId, paidAt);
      await connection.execute(
        'UPDATE payment SET receipt_no=? WHERE payment_id=?',
        [receiptNo, paymentId]
      );
    }

    await connection.execute('UPDATE `order` SET status=? WHERE order_id=?', ['DONE', order_id]);
    await connection.commit();
    res.status(201).json({ success: true, data: { payment_id: paymentId, amount } });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'ໃບສັ່ງກວດນີ້ຊຳລະເງິນແລ້ວ' });
    }
    sendServerError(res, err);
  } finally {
    connection.release();
  }
};

const adjustPayment = (status) => async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { reason } = req.body;
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ success: false, message: 'ກະລຸນາລະບຸເຫດຜົນ' });
    }

    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT pay.*, o.order_id
       FROM payment pay
       JOIN \`order\` o ON pay.order_id = o.order_id
       WHERE pay.payment_id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບລາຍການຊຳລະເງິນນີ້' });
    }

    const payment = rows[0];
    if ((payment.status || 'PAID') !== 'PAID') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'ລາຍການນີ້ຖືກ void/refund ແລ້ວ' });
    }

    await connection.execute(
      'UPDATE payment SET status=?, adjustment_reason=?, adjusted_by=?, adjusted_at=? WHERE payment_id=?',
      [status, String(reason).trim(), req.user?.id || null, new Date(), req.params.id]
    );
    await connection.execute('UPDATE `order` SET status=? WHERE order_id=?', ['COMPLETED', payment.order_id]);
    await connection.commit();
    res.json({ success: true, message: status === 'VOID' ? 'Void ສຳເລັດ' : 'Refund ສຳເລັດ' });
  } catch (err) {
    await connection.rollback();
    sendServerError(res, err);
  } finally {
    connection.release();
  }
};

const getSummary = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DATE(payment_date) as date, SUM(amount) as total, COUNT(*) as count
       FROM payment
       WHERE COALESCE(status, 'PAID') = 'PAID'
       GROUP BY DATE(payment_date)
       ORDER BY date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    sendServerError(res, err);
  }
};

module.exports = {
  getPayments,
  createPayment,
  getSummary,
  voidPayment: adjustPayment('VOID'),
  refundPayment: adjustPayment('REFUNDED'),
};

function buildReceiptNo(paymentId, paymentDate) {
  const date = paymentDate ? new Date(paymentDate) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const y = safeDate.getFullYear();
  const m = String(safeDate.getMonth() + 1).padStart(2, '0');
  const d = String(safeDate.getDate()).padStart(2, '0');
  return `RCPT-${y}${m}${d}-${String(paymentId).padStart(5, '0')}`;
}
