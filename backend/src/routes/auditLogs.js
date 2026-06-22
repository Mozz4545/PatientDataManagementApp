const express = require('express');
const { getAuditLogs } = require('../controllers/auditLogController');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

router.get('/', authGuard, roleGuard(['ADMIN']), getAuditLogs);

module.exports = router;
