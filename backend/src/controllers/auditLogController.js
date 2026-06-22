const pool = require('../db/connection');
const { sendServerError, toPositiveInt } = require('../utils/http');

const getAuditLogs = async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1);
    const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (req.query.q) {
      const search = `%${String(req.query.q).trim()}%`;
      conditions.push('(a.actor_name LIKE ? OR a.description LIKE ? OR a.entity_id LIKE ? OR a.ip_address LIKE ?)');
      params.push(search, search, search, search);
    }
    if (req.query.action) {
      conditions.push('a.action = ?');
      params.push(req.query.action);
    }
    if (req.query.entity_type) {
      conditions.push('a.entity_type = ?');
      params.push(req.query.entity_type);
    }
    if (req.query.from) {
      conditions.push('a.created_at >= ?');
      params.push(`${req.query.from} 00:00:00`);
    }
    if (req.query.to) {
      conditions.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(`${req.query.to} 00:00:00`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM audit_logs a ${where}`, params);
    const [rows] = await pool.execute(
      `SELECT a.audit_log_id, a.staff_id, a.actor_name, a.actor_role, a.action,
              a.entity_type, a.entity_id, a.description, a.metadata,
              a.ip_address, a.user_agent, a.created_at
       FROM audit_logs a
       ${where}
       ORDER BY a.created_at DESC, a.audit_log_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [summaryRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(created_at >= CURDATE()) AS today,
         SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS last_7_days,
         COUNT(DISTINCT staff_id) AS actors
       FROM audit_logs`
    );

    res.json({
      success: true,
      data: {
        items: rows,
        total: Number(countRows[0]?.total || 0),
        page,
        limit,
        summary: {
          total: Number(summaryRows[0]?.total || 0),
          today: Number(summaryRows[0]?.today || 0),
          last_7_days: Number(summaryRows[0]?.last_7_days || 0),
          actors: Number(summaryRows[0]?.actors || 0),
        },
      },
    });
  } catch (error) {
    sendServerError(res, error);
  }
};

module.exports = { getAuditLogs };
