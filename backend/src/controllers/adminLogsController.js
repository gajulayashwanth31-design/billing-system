const { query } = require("../config/db");

function buildFilters(filters) {
  const clauses = [];
  const params = [];
  if (filters.table) {
    clauses.push("table_name = ?");
    params.push(filters.table);
  }
  if (filters.userId) {
    clauses.push("changed_by = ?");
    params.push(filters.userId);
  }
  if (filters.from) {
    clauses.push("changed_at >= ?");
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    clauses.push("changed_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(filters.to);
  }
  return {
    params,
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}

async function auditLog(req, res) {
  const filters = req.validated.query;
  const { where, params } = buildFilters(filters);
  const limit = filters.limit;
  const offset = (filters.page - 1) * limit;
  const orderBy = filters.sort === "table_name" ? "table_name" : "changed_at";
  const [rows, counts] = await Promise.all([
    query(
      "ADMIN",
      `SELECT log.log_id AS id, log.table_name AS tableName, log.record_id AS recordId, log.action,
              log.old_value AS oldValue, log.new_value AS newValue, log.changed_by AS changedBy,
              actor.username AS changedByName, log.changed_at AS changedAt
       FROM audit_log log LEFT JOIN users actor ON actor.user_id = log.changed_by ${where}
       ORDER BY ${orderBy === "table_name" ? "log.table_name" : "log.changed_at"} ${filters.direction === "asc" ? "ASC" : "DESC"}, log.log_id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    query("ADMIN", `SELECT COUNT(*) AS total FROM audit_log ${where}`, params),
  ]);
  return res.json({
    data: rows,
    pagination: { page: filters.page, limit, total: counts[0].total },
  });
}

async function whatsappMessages(req, res) {
  const { page, limit, status, invoiceId, sort, direction } =
    req.validated.query;
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push("w.status = ?");
    params.push(status);
  }
  if (invoiceId) {
    clauses.push("w.invoice_id = ?");
    params.push(invoiceId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows, counts] = await Promise.all([
    query(
      "ADMIN",
      `SELECT w.msg_id AS id, w.invoice_id AS invoiceId, i.invoice_no AS invoiceNo,
              w.to_number AS toNumber, w.status, w.provider_message_id AS providerMessageId,
              w.error, w.attempts, w.created_at AS createdAt, w.updated_at AS updatedAt
       FROM whatsapp_messages w JOIN invoices i ON i.invoice_id = w.invoice_id
       ${where} ORDER BY ${sort === "status" ? "w.status" : "w.created_at"}
       ${direction === "asc" ? "ASC" : "DESC"}, w.msg_id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    ),
    query(
      "ADMIN",
      `SELECT COUNT(*) AS total FROM whatsapp_messages w ${where}`,
      params,
    ),
  ]);
  return res.json({
    data: rows,
    pagination: { page, limit, total: counts[0].total },
  });
}

module.exports = { auditLog, whatsappMessages };
