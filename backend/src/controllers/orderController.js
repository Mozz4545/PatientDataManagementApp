const pool = require('../db/connection');

const orderSelect = `
  SELECT o.*, p.first_name, p.last_name, e.exam_name, e.price AS exam_price, s.staff_name,
         r.result_id, pay.payment_id,
         CASE
           WHEN o.status IN ('CANCELLED', 'ຍົກເລີກແລ້ວ') THEN 'CANCELLED'
           WHEN pay.payment_id IS NOT NULL OR o.status = 'DONE' THEN 'DONE'
           WHEN r.result_id IS NOT NULL OR o.status = 'COMPLETED' THEN 'WAITING_PAYMENT'
           WHEN o.status IN ('IN_PROGRESS', 'ກຳລັງກວດ') THEN 'IN_PROGRESS'
           ELSE 'PENDING'
         END AS workflow_status
  FROM \`order\` o
  JOIN patients p ON o.patient_id = p.patient_id
  JOIN exam_types e ON o.exam_type_id = e.exam_type_id
  JOIN staff s ON o.staff_id = s.staff_id
  LEFT JOIN result r ON r.order_id = o.order_id
  LEFT JOIN payment pay ON pay.order_id = o.order_id AND COALESCE(pay.status, 'PAID') = 'PAID'
`;

// GET /api/orders
const getOrders = async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = orderSelect;
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
      `${orderSelect} WHERE o.order_id = ?`,
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
    const documentNo = buildOrderDocumentNo(result.insertId, order_date);
    const billingNo = buildBillingNo(result.insertId, order_date);
    await pool.execute(
      'UPDATE `order` SET document_no=?, billing_no=? WHERE order_id=?',
      [documentNo, billingNo, result.insertId]
    );
    res.status(201).json({ success: true, data: { order_id: result.insertId, document_no: documentNo, billing_no: billingNo } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'ສະຖານະບໍ່ຖືກຕ້ອງ' });
    }

    if (status === 'CANCELLED' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນທີ່ຍົກເລີກໃບສັ່ງກວດໄດ້' });
    }

    const [rows] = await pool.execute(
      `SELECT o.*, pay.payment_id, COALESCE(pay.status, 'PAID') AS payment_status
       FROM \`order\` o
       LEFT JOIN payment pay ON pay.order_id = o.order_id AND COALESCE(pay.status, 'PAID') = 'PAID'
       WHERE o.order_id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (order.payment_id) {
      return res.status(409).json({ success: false, message: 'ໃບສັ່ງກວດທີ່ຊຳລະແລ້ວບໍ່ສາມາດແກ້ສະຖານະໂດຍກົງໄດ້ ກະລຸນາໃຊ້ void/refund' });
    }

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

function buildOrderDocumentNo(orderId, orderDate) {
  return buildDatedNo('ORD', orderId, orderDate);
}

function buildBillingNo(orderId, orderDate) {
  return buildDatedNo('BILL', orderId, orderDate);
}

function buildDatedNo(prefix, id, value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const y = safeDate.getFullYear();
  const m = String(safeDate.getMonth() + 1).padStart(2, '0');
  const d = String(safeDate.getDate()).padStart(2, '0');
  return `${prefix}-${y}${m}${d}-${String(id).padStart(5, '0')}`;
}
