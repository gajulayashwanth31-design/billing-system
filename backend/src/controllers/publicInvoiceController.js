const { query } = require("../config/db");
const { generateInvoicePdf } = require("../services/pdfService");
const {
  isInvoiceHashValid,
  isSignedPdfRequestValid,
} = require("../services/invoiceSigning");
const { notFound, HttpError } = require("../utils/errors");

async function verify(req, res) {
  const { invoiceNo } = req.validated.params;
  const { h: suppliedHash } = req.validated.query;
  const rows = await query(
    "ADMIN",
    `SELECT i.invoice_no AS invoiceNo, DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
            totals.grand_total AS grandTotal
     FROM invoices i JOIN v_invoice_totals totals ON totals.invoice_id = i.invoice_id
     WHERE i.invoice_no = ?`,
    [invoiceNo],
  );
  if (!rows[0]) {
    return res.json({ data: { valid: false } });
  }
  const invoice = rows[0];
  const valid = isInvoiceHashValid(
    invoice.invoiceNo,
    invoice.grandTotal,
    invoice.createdAt,
    suppliedHash,
  );
  return res.json({
    data: valid
      ? {
          valid: true,
          invoiceNo: invoice.invoiceNo,
          createdAt: invoice.createdAt,
          grandTotal: invoice.grandTotal,
          shopName: process.env.SHOP_NAME || "Billing System",
        }
      : { valid: false },
  });
}

async function signedPdf(req, res, next) {
  const { invoiceNo } = req.validated.params;
  const { exp, sig } = req.validated.query;
  const now = Math.floor(Date.now() / 1000);
  if (!isSignedPdfRequestValid(invoiceNo, exp, sig, now)) {
    throw new HttpError(
      403,
      "SIGNED_URL_INVALID",
      "This invoice link is invalid or expired",
    );
  }
  const rows = await query(
    "ADMIN",
    "SELECT invoice_id AS id FROM invoices WHERE invoice_no = ?",
    [invoiceNo],
  );
  if (!rows[0]) throw notFound("Invoice not found");
  const generated = await generateInvoicePdf(rows[0].id);
  return res.download(generated.path, `${invoiceNo}.pdf`, (error) => {
    if (error && !res.headersSent) next(error);
    else if (error) console.error("Signed invoice PDF stream failed:", error);
  });
}

module.exports = { signedPdf, verify };
