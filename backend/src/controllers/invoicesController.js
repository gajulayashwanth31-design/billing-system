const { callCreateInvoice, callRecordPayment, query } = require("../config/db");
const { HttpError, notFound } = require("../utils/errors");
const invoiceNotifier = require("../services/invoiceNotifier");
const pdfService = require("../services/pdfService");

async function invoiceDetail(role, invoiceId, user) {
  const rowScope =
    role === "CASHIER"
      ? "AND i.cashier_id = ?"
      : role === "CUSTOMER"
        ? "AND i.customer_id = ?"
        : "";
  const parameters =
    role === "CASHIER"
      ? [invoiceId, user.userId]
      : role === "CUSTOMER"
        ? [invoiceId, user.customerId]
        : [invoiceId];
  const cashierSelect =
    role === "ADMIN" ? ", u.username AS cashierUsername" : "";
  const cashierJoin =
    role === "ADMIN" ? "JOIN users u ON u.user_id = i.cashier_id" : "";
  const invoices = await query(
    role,
    `SELECT i.invoice_id AS id, i.invoice_no AS invoiceNo, i.customer_id AS customerId,
            i.cashier_id AS cashierId, i.status, i.created_at AS createdAt,
            c.name AS customerName, c.phone AS customerPhone ${cashierSelect},
            t.subtotal, t.tax, t.discount_amount AS discountAmount,
            t.coupon_discount_amount AS couponDiscountAmount,
            t.tier_discount_amount AS tierDiscountAmount,
            i.tier_discount_percent AS tierDiscountPercent,
            t.grand_total AS grandTotal, t.paid_amount AS paidAmount, t.balance
     FROM invoices i
     JOIN customers c ON c.customer_id = i.customer_id
     ${cashierJoin}
     JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
     WHERE i.invoice_id = ? ${rowScope}`,
    parameters,
  );
  if (!invoices[0]) throw notFound("Invoice not found");
  const [items, payments, messages] = await Promise.all([
    query(
      role,
      `SELECT item_id AS id, product_id AS productId, product_name AS productName, quantity,
              unit_price AS unitPrice, tax_rate AS taxRate, line_subtotal AS lineSubtotal,
              line_tax AS lineTax, line_total AS lineTotal
       FROM v_invoice_items_calc WHERE invoice_id = ? ORDER BY item_id`,
      [invoiceId],
    ),
    query(
      role,
      `SELECT p.payment_id AS id, p.amount, p.paid_at AS paidAt, p.reference_no AS referenceNo,
              method.name AS method
       FROM payments p JOIN payment_methods method ON method.method_id = p.method_id
       WHERE p.invoice_id = ? ORDER BY p.paid_at, p.payment_id`,
      [invoiceId],
    ),
    query(
      role,
      `SELECT msg_id AS id, status, provider_message_id AS providerMessageId,
              error, attempts, updated_at AS updatedAt
       FROM whatsapp_messages WHERE invoice_id = ? ORDER BY created_at DESC, msg_id DESC LIMIT 1`,
      [invoiceId],
    ),
  ]);
  return { ...invoices[0], items, payments, whatsapp: messages[0] || null };
}

async function list(req, res) {
  const { page, limit, search, sort, direction, status, from, to, cashierId } =
    req.validated.query;
  const filters = [];
  const parameters = [];
  if (req.user.role === "CASHIER") {
    filters.push("i.cashier_id = ?");
    parameters.push(req.user.userId);
  }
  if (status) {
    filters.push("i.status = ?");
    parameters.push(status);
  }
  if (from) {
    filters.push("i.created_at >= ?");
    parameters.push(`${from} 00:00:00`);
  }
  if (to) {
    filters.push("i.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    parameters.push(to);
  }
  if (cashierId && req.user.role === "ADMIN") {
    filters.push("i.cashier_id = ?");
    parameters.push(cashierId);
  }
  if (search) {
    filters.push("(i.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)");
    parameters.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const orderBy =
    sort === "grand_total"
      ? "t.grand_total"
      : sort === "status"
        ? "i.status"
        : "i.created_at";
  const cashierSelect =
    req.user.role === "ADMIN" ? ", u.username AS cashierUsername" : "";
  const cashierJoin =
    req.user.role === "ADMIN" ? "JOIN users u ON u.user_id = i.cashier_id" : "";
  const rows = await query(
    req.user.role,
    `SELECT i.invoice_id AS id, i.invoice_no AS invoiceNo, c.name AS customerName,
            i.status, i.created_at AS createdAt, t.grand_total AS grandTotal,
            t.paid_amount AS paidAmount, t.balance ${cashierSelect}
     FROM invoices i JOIN customers c ON c.customer_id = i.customer_id
     JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
     ${cashierJoin}
     ${where}
     ORDER BY ${orderBy} ${direction === "desc" ? "DESC" : "ASC"}, i.invoice_id DESC
     LIMIT ? OFFSET ?`,
    [...parameters, limit, (page - 1) * limit],
  );
  if (req.user.role === "CASHIER") {
    rows.forEach((invoice) => {
      invoice.cashierUsername = req.user.username;
    });
  }
  const countRows = await query(
    req.user.role,
    `SELECT COUNT(*) AS total FROM invoices i JOIN customers c ON c.customer_id = i.customer_id ${where}`,
    parameters,
  );
  return res.json({
    data: rows,
    pagination: { page, limit, total: countRows[0].total },
  });
}

async function getById(req, res) {
  const invoice = await invoiceDetail(
    req.user.role,
    req.validated.params.id,
    req.user,
  );
  return res.json({ data: invoice });
}

async function create(req, res) {
  const { customerId, discountCode, items } = req.validated.body;
  const invoiceId = await callCreateInvoice(
    req.user.role,
    customerId,
    req.user.userId,
    discountCode,
    items,
  );
  const invoice = await invoiceDetail(req.user.role, invoiceId, req.user);
  return res.status(201).json({ data: invoice });
}

async function addPayment(req, res) {
  const { id } = req.validated.params;
  const { methodId, amount, referenceNo } = req.validated.body;
  const cashierFilter = req.user.role === "CASHIER" ? "AND cashier_id = ?" : "";
  const invoiceParams =
    req.user.role === "CASHIER" ? [id, req.user.userId] : [id];
  const invoiceRows = await query(
    req.user.role,
    `SELECT invoice_id, status FROM invoices WHERE invoice_id = ? ${cashierFilter}`,
    invoiceParams,
  );
  if (!invoiceRows[0]) throw notFound("Invoice not found");
  await callRecordPayment(
    req.user.role,
    id,
    req.user.userId,
    methodId,
    amount,
    referenceNo,
  );
  const statusRows = await query(
    req.user.role,
    "SELECT status FROM invoices WHERE invoice_id = ?",
    [id],
  );
  if (statusRows[0].status === "PAID") {
    await invoiceNotifier
      .afterInvoicePaid(id)
      .catch((error) =>
        console.error(`Invoice ${id} notification could not be queued:`, error),
      );
  }
  return res.status(201).json({
    message: "Payment recorded successfully",
    data: await invoiceDetail(req.user.role, id, req.user),
  });
}

async function voidInvoice(req, res) {
  const { id } = req.validated.params;
  const { reason } = req.validated.body;
  const existing = await query(
    "ADMIN",
    "SELECT invoice_id FROM invoices WHERE invoice_id = ?",
    [id],
  );
  if (!existing[0]) throw notFound("Invoice not found");
  await query("ADMIN", "CALL sp_void_invoice(?, ?, ?)", [
    id,
    reason,
    req.user.userId,
  ]);
  return res.json({
    message: "Invoice voided successfully",
    data: await invoiceDetail("ADMIN", id, req.user),
  });
}

async function downloadPdf(req, res, next) {
  const invoice = await invoiceDetail(
    req.user.role,
    req.validated.params.id,
    req.user,
  );
  const generated = await pdfService.generateInvoicePdf(invoice.id);
  res.setHeader("Cache-Control", "private, no-store");
  return res.download(
    generated.path,
    `${invoice.invoiceNo}.pdf`,
    (error) => {
      if (error && !res.headersSent) next(error);
      else if (error) console.error("Invoice PDF stream failed:", error);
    },
  );
}

async function resendWhatsApp(req, res) {
  const invoice = await invoiceDetail(
    req.user.role,
    req.validated.params.id,
    req.user,
  );
  if (invoice.status !== "PAID") {
    throw new HttpError(
      409,
      "INVOICE_NOT_PAID",
      "Only paid invoices can be sent by WhatsApp",
    );
  }
  const messageId = await invoiceNotifier.afterInvoicePaid(invoice.id);
  const updatedInvoice = await invoiceDetail(
    req.user.role,
    invoice.id,
    req.user,
  );
  return res.status(202).json({
    data: {
      messageId,
      status: updatedInvoice.whatsapp?.status || "UNAVAILABLE",
    },
  });
}

module.exports = {
  addPayment,
  create,
  getById,
  invoiceDetail,
  list,
  downloadPdf,
  resendWhatsApp,
  voidInvoice,
};
