const fs = require('fs');
const path = require('path');
const pool = require('../db/connection');
const { isPositiveInt, requiredString, sendServerError } = require('../utils/http');

const resultSelect = `
  SELECT r.*, s.staff_name, o.patient_id, o.order_date, o.status AS order_status,
         p.first_name, p.last_name, p.phone AS patient_phone, e.exam_name
  FROM result r
  JOIN staff s ON r.staff_id = s.staff_id
  JOIN \`order\` o ON r.order_id = o.order_id
  JOIN patients p ON o.patient_id = p.patient_id
  JOIN exam_types e ON o.exam_type_id = e.exam_type_id
`;

const getResults = async (_req, res) => {
  try {
    const [rows] = await pool.execute(`${resultSelect} ORDER BY r.result_date DESC`);
    res.json({ success: true, data: rows });
  } catch (err) {
    sendServerError(res, err);
  }
};

const getResultByOrder = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `${resultSelect} WHERE r.order_id = ? LIMIT 1`,
      [req.params.orderId]
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    sendServerError(res, err);
  }
};

const getResultImage = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT result_image_url FROM result WHERE result_id = ? LIMIT 1',
      [req.params.id]
    );
    if (!rows.length || !rows[0].result_image_url) {
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບຮູບຜົນກວດ' });
    }

    const filename = path.basename(rows[0].result_image_url);
    const filePath = path.join(__dirname, '../../uploads/results', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບໄຟລ໌ຮູບຜົນກວດ' });
    }

    res.sendFile(filePath);
  } catch (err) {
    sendServerError(res, err);
  }
};

const createResult = async (req, res) => {
  try {
    const { order_id, result_detail } = req.body;
    const staffId = req.user?.id;
    const resultImageUrl = req.file ? `/uploads/results/${req.file.filename}` : null;

    if (!isPositiveInt(order_id) || !staffId || !requiredString(result_detail)) {
      cleanupRequestFile(req.file);
      return res.status(400).json({ success: false, message: 'ກະລຸນາລະບຸໃບສັ່ງກວດ ແລະ ລາຍລະອຽດຜົນກວດ' });
    }

    const [orders] = await pool.execute('SELECT status FROM `order` WHERE order_id = ? LIMIT 1', [order_id]);
    if (!orders.length) {
      cleanupRequestFile(req.file);
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບໃບສັ່ງກວດນີ້' });
    }
    if (orders[0].status === 'CANCELLED') {
      cleanupRequestFile(req.file);
      return res.status(400).json({ success: false, message: 'ໃບສັ່ງກວດທີ່ຍົກເລີກແລ້ວບໍ່ສາມາດບັນທຶກຜົນໄດ້' });
    }

    const [existing] = await pool.execute('SELECT result_id FROM result WHERE order_id = ? LIMIT 1', [order_id]);
    if (existing.length) {
      cleanupRequestFile(req.file);
      return res.status(409).json({ success: false, message: 'ໃບສັ່ງກວດນີ້ມີຜົນກວດແລ້ວ' });
    }

    const [result] = await pool.execute(
      'INSERT INTO result (order_id, staff_id, result_detail, result_image_url, result_date) VALUES (?, ?, ?, ?, NOW())',
      [order_id, staffId, result_detail.trim(), resultImageUrl]
    );
    const [resultRows] = await pool.execute('SELECT result_date FROM result WHERE result_id = ? LIMIT 1', [result.insertId]);
    const reportNo = buildReportNo(result.insertId, resultRows[0]?.result_date || new Date());
    await pool.execute('UPDATE result SET report_no=? WHERE result_id=?', [reportNo, result.insertId]);
    await pool.execute('UPDATE `order` SET status=? WHERE order_id=? AND status <> ?', ['COMPLETED', order_id, 'DONE']);
    await pool.execute(
      `UPDATE queue
       SET status=?
       WHERE order_id=? AND status NOT IN (?, ?)`,
      ['ສຳເລັດ', order_id, 'ຍົກເລີກແລ້ວ', 'CANCELLED']
    );
    res.status(201).json({
      success: true,
      data: { result_id: result.insertId, report_no: reportNo, result_image_url: resultImageUrl },
    });
  } catch (err) {
    cleanupRequestFile(req.file);
    sendServerError(res, err);
  }
};

const updateResult = async (req, res) => {
  try {
    const { result_detail, remove_result_image } = req.body;
    const resultImageUrl = req.file ? `/uploads/results/${req.file.filename}` : undefined;
    if (!requiredString(result_detail)) {
      cleanupRequestFile(req.file);
      return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນລາຍລະອຽດຜົນກວດ' });
    }

    const [rows] = await pool.execute(
      `SELECT r.*, pay.payment_id, COALESCE(pay.status, 'PAID') AS payment_status
       FROM result r
       LEFT JOIN payment pay ON pay.order_id = r.order_id AND COALESCE(pay.status, 'PAID') = 'PAID'
       WHERE r.result_id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) {
      cleanupRequestFile(req.file);
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບຜົນກວດນີ້' });
    }

    const oldResult = rows[0];
    if (oldResult.payment_id && req.user?.role !== 'ADMIN') {
      cleanupRequestFile(req.file);
      return res.status(403).json({ success: false, message: 'ຜົນກວດທີ່ຊຳລະແລ້ວ ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນທີ່ແກ້ໄຂໄດ້' });
    }

    const shouldRemoveImage = remove_result_image === 'true' || remove_result_image === true;
    const nextImageUrl = resultImageUrl || (shouldRemoveImage ? null : oldResult.result_image_url);

    const [result] = await pool.execute(
      'UPDATE result SET result_detail=?, result_image_url=? WHERE result_id=?',
      [result_detail.trim(), nextImageUrl, req.params.id]
    );
    if (result.affectedRows === 0) {
      cleanupRequestFile(req.file);
      return res.status(404).json({ success: false, message: 'ບໍ່ພົບຜົນກວດນີ້' });
    }

    if ((resultImageUrl || shouldRemoveImage) && oldResult.result_image_url) {
      deleteUploadedResultImage(oldResult.result_image_url);
    }

    res.json({
      success: true,
      message: 'ອັບເດດສຳເລັດ',
      data: { result_image_url: nextImageUrl },
    });
  } catch (err) {
    cleanupRequestFile(req.file);
    sendServerError(res, err);
  }
};

module.exports = { getResults, getResultByOrder, getResultImage, createResult, updateResult };

function deleteUploadedResultImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/results/')) return;
  const filename = path.basename(imageUrl);
  const filePath = path.join(__dirname, '../../uploads/results', filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Delete result image failed:', err.message);
    }
  });
}

function cleanupRequestFile(file) {
  if (!file?.path) return;
  fs.unlink(file.path, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Cleanup result image failed:', err.message);
    }
  });
}

function buildReportNo(resultId, resultDate) {
  const date = resultDate ? new Date(resultDate) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const y = safeDate.getFullYear();
  const m = String(safeDate.getMonth() + 1).padStart(2, '0');
  const d = String(safeDate.getDate()).padStart(2, '0');
  return `XR-${y}${m}${d}-${String(resultId).padStart(5, '0')}`;
}
