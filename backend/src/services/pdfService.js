const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { query } = require("../config/db");
const { notFound } = require("../utils/errors");
const { createInvoiceHash, createSignedPdfUrl } = require("./invoiceSigning");

const invoiceStorage =
  process.env.INVOICE_STORAGE_DIR ||
  path.join(__dirname, "..", "..", "storage", "invoices");

function formatMoney(value) {
  return `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function invoiceFile(invoiceNo) {
  if (!/^[A-Za-z0-9-]{1,30}$/.test(invoiceNo)) {
    throw new TypeError("Invoice number is not valid for a PDF filename");
  }
  return path.join(invoiceStorage, `${invoiceNo}.pdf`);
}

async function invoiceData(invoiceId) {
  const rows = await query(
    "ADMIN",
    `SELECT i.invoice_id AS id, i.invoice_no AS invoiceNo, i.status,
            DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
            c.name AS customerName, c.phone AS customerPhone,
            u.username AS cashierName, d.code AS discountCode,
            i.tier_discount_percent AS tierDiscountPercent,
            totals.subtotal, totals.tax, totals.coupon_discount_amount AS couponDiscountAmount,
            totals.tier_discount_amount AS tierDiscountAmount,
            totals.discount_amount AS discountAmount, totals.grand_total AS grandTotal,
            totals.paid_amount AS paidAmount, totals.balance
     FROM invoices i
     JOIN customers c ON c.customer_id = i.customer_id
     JOIN users u ON u.user_id = i.cashier_id
     LEFT JOIN discounts d ON d.discount_id = i.discount_id
     JOIN v_invoice_totals totals ON totals.invoice_id = i.invoice_id
     WHERE i.invoice_id = ?`,
    [invoiceId],
  );
  if (!rows[0]) throw notFound("Invoice not found");
  const [items, payments] = await Promise.all([
    query(
      "ADMIN",
      `SELECT product_name AS productName, quantity, unit_price AS unitPrice,
              tax_rate AS taxRate, line_subtotal AS lineSubtotal,
              line_tax AS lineTax, line_total AS lineTotal
       FROM v_invoice_items_calc WHERE invoice_id = ? ORDER BY item_id`,
      [invoiceId],
    ),
    query(
      "ADMIN",
      `SELECT method.name AS method, payment.amount, payment.reference_no AS referenceNo
       FROM payments payment
       JOIN payment_methods method ON method.method_id = payment.method_id
       WHERE payment.invoice_id = ? ORDER BY payment.paid_at, payment.payment_id`,
      [invoiceId],
    ),
  ]);
  return { ...rows[0], items, payments };
}

function drawTotalsRow(document, label, value, options = {}) {
  const y = document.y;
  document
    .font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.bold ? 11 : 9)
    .fillColor(options.color || "#27382f")
    .text(label, 345, y, { width: 105, align: "right" })
    .text(value, 455, y, { width: 105, align: "right" });
  document.moveDown(0.55);
}

async function renderInvoicePdf(invoice) {
  const document = new PDFDocument({ size: "A4", margin: 48 });
  const chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  const complete = new Promise((resolve, reject) => {
    document.on("end", resolve);
    document.on("error", reject);
  });
  const shopName = process.env.SHOP_NAME || "Billing System";
  const invoiceHash = createInvoiceHash(
    invoice.invoiceNo,
    invoice.grandTotal,
    invoice.createdAt,
  );
  const verifyUrl = `${(process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "")}/verify/${encodeURIComponent(invoice.invoiceNo)}?h=${invoiceHash}`;
  const verifyQr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 112 });
  const paymentQr =
    Number(invoice.balance) > 0 && process.env.UPI_ID
      ? await QRCode.toBuffer(
          `upi://pay?pa=${encodeURIComponent(process.env.UPI_ID)}&pn=${encodeURIComponent(shopName)}&am=${Number(invoice.balance).toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.invoiceNo)}`,
          { margin: 1, width: 112 },
        )
      : null;

  document.font("Helvetica-Bold").fontSize(21).fillColor("#315f4b");
  document.text(shopName, 48, 46, { width: 350 });
  document.font("Helvetica").fontSize(9).fillColor("#56645c");
  if (process.env.SHOP_ADDRESS) {
    document.text(process.env.SHOP_ADDRESS, 48, document.y + 5, {
      width: 350,
    });
  }
  if (process.env.SHOP_GSTIN) {
    document.text(`GSTIN: ${process.env.SHOP_GSTIN}`, 48, document.y + 3, {
      width: 350,
    });
  }
  document
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#27382f")
    .text("TAX INVOICE", 405, 48, { width: 140, align: "right" });
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#56645c")
    .text(invoice.invoiceNo, 405, 71, { width: 140, align: "right" })
    .text(invoice.createdAt, 405, 85, { width: 140, align: "right" });

  document.moveTo(48, 123).lineTo(547, 123).strokeColor("#dce5dd").stroke();
  document.y = 139;
  document
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#87948b")
    .text("BILL TO", 48, document.y);
  document
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#27382f")
    .text(invoice.customerName, 48, document.y + 12);
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#56645c")
    .text(invoice.customerPhone, 48, document.y + 3);
  document
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#87948b")
    .text("SERVED BY", 350, 139);
  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#27382f")
    .text(invoice.cashierName, 350, 151);
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#56645c")
    .text(`Payment status: ${invoice.status}`, 350, 168);

  let y = 208;
  const columns = [
    { label: "ITEM", x: 48, width: 220, align: "left" },
    { label: "QTY", x: 270, width: 38, align: "right" },
    { label: "RATE", x: 312, width: 70, align: "right" },
    { label: "TAX", x: 390, width: 48, align: "right" },
    { label: "AMOUNT", x: 446, width: 101, align: "right" },
  ];
  document.rect(48, y, 499, 23).fill("#edf4ef");
  document.font("Helvetica-Bold").fontSize(8).fillColor("#506157");
  columns.forEach((column) =>
    document.text(column.label, column.x, y + 7, {
      width: column.width,
      align: column.align,
    }),
  );
  y += 31;
  for (const item of invoice.items) {
    if (y > 710) {
      document.addPage();
      y = 52;
    }
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#27382f")
      .text(item.productName, 48, y, { width: 220 })
      .text(String(item.quantity), 270, y, { width: 38, align: "right" })
      .text(formatMoney(item.unitPrice), 312, y, { width: 70, align: "right" })
      .text(`${Number(item.taxRate).toFixed(2)}%`, 390, y, {
        width: 48,
        align: "right",
      })
      .text(formatMoney(item.lineTotal), 446, y, {
        width: 101,
        align: "right",
      });
    y += 25;
    document
      .moveTo(48, y - 7)
      .lineTo(547, y - 7)
      .strokeColor("#edf0ed")
      .stroke();
  }
  if (y + 160 > 770) {
    document.addPage();
    y = 48;
  }
  document.y = y + 8;
  drawTotalsRow(document, "Subtotal", formatMoney(invoice.subtotal));
  drawTotalsRow(document, "Tax", formatMoney(invoice.tax));
  if (Number(invoice.couponDiscountAmount) > 0) {
    drawTotalsRow(
      document,
      invoice.discountCode
        ? `Coupon (${invoice.discountCode})`
        : "Coupon discount",
      `− ${formatMoney(invoice.couponDiscountAmount)}`,
    );
  }
  if (Number(invoice.tierDiscountAmount) > 0) {
    drawTotalsRow(
      document,
      `Loyalty discount (${Number(invoice.tierDiscountPercent)}%)`,
      `− ${formatMoney(invoice.tierDiscountAmount)}`,
    );
  }
  drawTotalsRow(document, "Grand total", formatMoney(invoice.grandTotal), {
    bold: true,
  });
  drawTotalsRow(
    document,
    `Paid · ${invoice.payments.map((payment) => payment.method).join(", ") || "Unpaid"}`,
    formatMoney(invoice.paidAmount),
  );
  if (Number(invoice.balance) > 0) {
    drawTotalsRow(document, "Balance due", formatMoney(invoice.balance), {
      bold: true,
      color: "#a15b34",
    });
  }

  const qrY = Math.min(Math.max(document.y + 9, 690), 730);
  document.image(verifyQr, 48, qrY, { width: 78, height: 78 });
  document
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#56645c")
    .text("Scan to verify this invoice", 48, qrY + 81, {
      width: 120,
      align: "center",
    });
  if (paymentQr) {
    document.image(paymentQr, 405, qrY, { width: 78, height: 78 });
    document
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#56645c")
      .text("Scan to pay the balance", 384, qrY + 81, {
        width: 120,
        align: "center",
      });
  }
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#315f4b")
    .text("Thank you for your business.", 181, qrY + 43, {
      width: 230,
      align: "center",
    });
  document.end();
  await complete;
  return Buffer.concat(chunks);
}

async function generateInvoicePdf(invoiceId) {
  const invoice = await invoiceData(invoiceId);
  const target = invoiceFile(invoice.invoiceNo);
  try {
    await fs.promises.access(target, fs.constants.R_OK);
    return { path: target, invoice };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await fs.promises.mkdir(invoiceStorage, { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    const buffer = await renderInvoicePdf(invoice);
    await fs.promises.writeFile(temporary, buffer, { flag: "wx" });
    try {
      await fs.promises.rename(temporary, target);
    } catch (error) {
      if (error.code !== "EEXIST" && error.code !== "EPERM") throw error;
      await fs.promises.access(target, fs.constants.R_OK);
    }
    return { path: target, invoice };
  } finally {
    await fs.promises.rm(temporary, { force: true });
  }
}

module.exports = {
  createSignedPdfUrl,
  formatMoney,
  generateInvoicePdf,
  invoiceData,
};
