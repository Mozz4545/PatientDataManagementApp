const pool = require('../db/connection');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function auditLogger(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  let responseBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400 || responseBody?.success === false) return;
    const event = buildAuditEvent(req, responseBody);
    if (!event) return;
    writeAuditLog(req, event).catch((error) => {
      console.error('Audit log write failed:', error.code || error.message || error);
    });
  });

  next();
}

function buildAuditEvent(req, responseBody) {
  const path = `${req.baseUrl || ''}${req.path || ''}`.replace(/^\/api/, '');
  const route = path.split('/').filter(Boolean);
  const resource = route[0];
  const paramId = req.params?.id || req.params?.orderId;
  const responseData = responseBody?.data || {};

  if (resource === 'auth') {
    if (route[1] === 'login') {
      const user = responseData.user;
      if (!user?.id) return null;
      req.user = { id: user.id, username: user.username, role: user.role };
      req.auditActorName = user.name;
      return event('LOGIN', 'AUTH', String(user.id), 'ເຂົ້າລະບົບສຳເລັດ');
    }
    if (route[1] === 'logout') return event('LOGOUT', 'AUTH', String(req.user?.id || ''), 'ອອກຈາກລະບົບ');
    return null;
  }

  if (resource === 'patients') {
    const id = paramId || responseData.patient_id;
    if (req.method === 'POST') return event('CREATE', 'PATIENT', id, `ເພີ່ມຂໍ້ມູນຄົນເຈັບ ${formatId('HN', id, 6)}`);
    if (req.method === 'PUT') return event('UPDATE', 'PATIENT', id, `ແກ້ໄຂຂໍ້ມູນຄົນເຈັບ ${formatId('HN', id, 6)}`);
    if (req.method === 'DELETE') return event('DEACTIVATE', 'PATIENT', id, `ປິດການນຳໃຊ້ຂໍ້ມູນຄົນເຈັບ ${formatId('HN', id, 6)}`);
  }

  if (resource === 'staff') {
    const id = paramId || responseData.staff_id;
    if (req.method === 'POST') return event('CREATE', 'STAFF', id, `ເພີ່ມບັນຊີພະນັກງານ ${formatId('STF', id, 4)}`);
    if (route[2] === 'password') return event('RESET_PASSWORD', 'STAFF', id, `ປ່ຽນລະຫັດຜ່ານພະນັກງານ ${formatId('STF', id, 4)}`);
    if (req.method === 'PUT') return event('UPDATE', 'STAFF', id, `ແກ້ໄຂຂໍ້ມູນພະນັກງານ ${formatId('STF', id, 4)}`);
    if (req.method === 'DELETE') return event('DEACTIVATE', 'STAFF', id, `ປິດການນຳໃຊ້ພະນັກງານ ${formatId('STF', id, 4)}`);
  }

  if (resource === 'orders') {
    const id = paramId || responseData.order_id;
    if (req.method === 'POST') return event('CREATE', 'ORDER', id, `ສ້າງໃບສັ່ງກວດ ${responseData.document_no || formatId('ORD', id, 5)}`);
    if (route[2] === 'status') {
      const action = req.body?.status === 'CANCELLED' ? 'CANCEL' : 'STATUS_CHANGE';
      return event(action, 'ORDER', id, `ປ່ຽນສະຖານະໃບສັ່ງກວດເປັນ ${req.body?.status || '-'}`);
    }
  }

  if (resource === 'queues') {
    const id = paramId || responseData.queue_id;
    if (req.method === 'POST' && route[1] === 'call-next') {
      if (!responseData?.queue_id) return null;
      return event('CALL', 'QUEUE', responseData.queue_id, `ເອີ້ນຄິວໝາຍເລກ ${responseData.queue_no || '-'}`);
    }
    if (req.method === 'POST') return event('CREATE', 'QUEUE', id, `ສ້າງຄິວໝາຍເລກ ${responseData.queue_no || '-'}`);
    if (route[2] === 'call') return event('CALL', 'QUEUE', id, `ເອີ້ນຄິວໝາຍເລກ ${responseData.queue_no || '-'}`);
    if (route[2] === 'status') return event('STATUS_CHANGE', 'QUEUE', id, `ປ່ຽນສະຖານະຄິວເປັນ ${req.body?.status || '-'}`);
  }

  if (resource === 'results') {
    const id = paramId || responseData.result_id;
    if (req.method === 'POST') return event('CREATE', 'RESULT', id, `ບັນທຶກຜົນກວດ ${responseData.report_no || formatId('XR', id, 5)}`);
    if (req.method === 'PUT') return event('UPDATE', 'RESULT', id, `ແກ້ໄຂຜົນກວດ ${formatId('XR', id, 5)}`);
  }

  if (resource === 'payments') {
    const id = paramId || responseData.payment_id;
    if (req.method === 'POST') return event('PAYMENT', 'PAYMENT', id, `ບັນທຶກການຊຳລະເງິນ ${formatId('PAY', id, 5)}`);
    if (route[2] === 'void') return event('VOID', 'PAYMENT', id, `ຍົກເລີກລາຍການຊຳລະ ${formatId('PAY', id, 5)}`);
    if (route[2] === 'refund') return event('REFUND', 'PAYMENT', id, `ຄືນເງິນລາຍການ ${formatId('PAY', id, 5)}`);
  }

  if (resource === 'exam-types') {
    const id = paramId || responseData.exam_type_id;
    if (req.method === 'POST') return event('CREATE', 'EXAM_TYPE', id, `ເພີ່ມປະເພດການກວດ ${req.body?.exam_name || ''}`.trim());
    if (req.method === 'PUT') return event('UPDATE', 'EXAM_TYPE', id, `ແກ້ໄຂປະເພດການກວດ ${req.body?.exam_name || ''}`.trim());
    if (req.method === 'DELETE') return event('DEACTIVATE', 'EXAM_TYPE', id, `ປິດການນຳໃຊ້ປະເພດການກວດ ${formatId('EXAM', id, 3)}`);
  }

  return null;
}

function event(action, entityType, entityId, description) {
  return {
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    description,
  };
}

async function writeAuditLog(req, auditEvent) {
  const staffId = req.user?.id || null;
  let actorName = req.auditActorName || null;
  if (!actorName && staffId) {
    const [rows] = await pool.execute('SELECT staff_name FROM staff WHERE staff_id = ? LIMIT 1', [staffId]);
    actorName = rows[0]?.staff_name || req.user?.username || null;
  }

  await pool.execute(
    `INSERT INTO audit_logs
      (staff_id, actor_name, actor_role, action, entity_type, entity_id, description, metadata, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      staffId,
      actorName,
      req.user?.role || null,
      auditEvent.action,
      auditEvent.entityType,
      auditEvent.entityId,
      auditEvent.description,
      JSON.stringify(buildSafeMetadata(req)),
      getClientIp(req),
      String(req.get('user-agent') || '').slice(0, 500) || null,
    ]
  );
}

function buildSafeMetadata(req) {
  const metadata = { method: req.method, path: `${req.baseUrl || ''}${req.path || ''}` };
  const safeFields = ['status', 'payment_type', 'order_id', 'patient_id', 'exam_type_id', 'queue_date', 'role'];
  for (const field of safeFields) {
    if (req.body?.[field] !== undefined) metadata[field] = req.body[field];
  }
  return metadata;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
  return (value.trim() || req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null;
}

function formatId(prefix, id, length) {
  return id ? `${prefix}-${String(id).padStart(length, '0')}` : prefix;
}

module.exports = auditLogger;
