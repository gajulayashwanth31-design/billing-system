const { query } = require("../config/db");

async function summary(req, res) {
  const [sales, invoices, topCashier, lowStock] = await Promise.all([
    query(
      "ADMIN",
      `SELECT COALESCE(SUM(grand_total), 0) AS todaySales
                    FROM invoices i JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
                    WHERE i.status = 'PAID' AND DATE(i.created_at) = CURRENT_DATE()`,
    ),
    query(
      "ADMIN",
      `SELECT COUNT(*) AS invoicesToday FROM invoices WHERE DATE(created_at) = CURRENT_DATE()`,
    ),
    query(
      "ADMIN",
      `SELECT u.username, COUNT(i.invoice_id) AS invoiceCount
                    FROM invoices i JOIN users u ON u.user_id = i.cashier_id
                    WHERE i.status = 'PAID' AND DATE(i.created_at) = CURRENT_DATE()
                    GROUP BY u.user_id, u.username ORDER BY invoiceCount DESC LIMIT 1`,
    ),
    query("ADMIN", "SELECT COUNT(*) AS lowStockCount FROM v_low_stock"),
  ]);
  return res.json({
    data: {
      todaySales: sales[0].todaySales,
      invoicesToday: invoices[0].invoicesToday,
      topCashier: topCashier[0] || null,
      lowStockCount: lowStock[0].lowStockCount,
    },
  });
}

async function salesByDay(req, res) {
  const limit = req.validated.query.limit;
  const rows = await query(
    "ADMIN",
    "SELECT sale_date, invoice_count, sales_total FROM v_daily_sales ORDER BY sale_date DESC LIMIT ?",
    [limit],
  );
  return res.json({ data: rows });
}

async function salesByCategory(req, res) {
  const rows = await query(
    "ADMIN",
    "SELECT category_id, category_name, sales_total, units_sold FROM v_sales_by_category ORDER BY sales_total DESC",
  );
  return res.json({ data: rows });
}

async function paymentSplit(req, res) {
  const rows = await query(
    "ADMIN",
    `SELECT pm.name AS method, COUNT(pay.payment_id) AS paymentCount, ROUND(SUM(pay.amount), 2) AS amount
     FROM payments pay JOIN payment_methods pm ON pm.method_id = pay.method_id
     JOIN invoices i ON i.invoice_id = pay.invoice_id
     WHERE i.status = 'PAID'
     GROUP BY pm.method_id, pm.name ORDER BY amount DESC`,
  );
  return res.json({ data: rows });
}

async function topProducts(req, res) {
  const rows = await query(
    "ADMIN",
    "SELECT product_id, sku, name, units_sold, sales_total FROM v_top_products ORDER BY units_sold DESC, sales_total DESC LIMIT ?",
    [req.validated.query.limit],
  );
  return res.json({ data: rows });
}

async function topCashiers(req, res) {
  const rows = await query(
    "ADMIN",
    `SELECT u.user_id AS cashierId, u.username, COUNT(i.invoice_id) AS invoiceCount,
            ROUND(SUM(t.grand_total), 2) AS salesTotal
     FROM invoices i JOIN users u ON u.user_id = i.cashier_id
     JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
     WHERE i.status = 'PAID'
     GROUP BY u.user_id, u.username ORDER BY salesTotal DESC LIMIT ?`,
    [req.validated.query.limit],
  );
  return res.json({ data: rows });
}

async function lowStock(req, res) {
  const rows = await query(
    "ADMIN",
    "SELECT product_id, sku, name, reorder_level, quantity FROM v_low_stock ORDER BY quantity, name LIMIT ?",
    [req.validated.query.limit],
  );
  return res.json({ data: rows });
}

module.exports = {
  lowStock,
  paymentSplit,
  salesByCategory,
  salesByDay,
  summary,
  topCashiers,
  topProducts,
};
