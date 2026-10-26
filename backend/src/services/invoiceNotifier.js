const { query } = require("../config/db");
const pdfService = require("./pdfService");
const { normalizeIndianPhone } = require("./whatsapp/phone");
const { getProvider } = require("./whatsapp");

const maxAttempts = 4;
const retryDelays = [2000, 4000, 8000];

function wait(milliseconds) {
  return new Promise((resolve) => require("timers").setTimeout(resolve, milliseconds));
}

function logDeliveryFailure(invoiceId, error) {
  console.error(`Invoice ${invoiceId} WhatsApp delivery failed:`, error);
}

async function deliver(messageId, invoiceId, phone, invoiceNo, total, itemCount) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await query(
      "CASHIER",
      "UPDATE whatsapp_messages SET attempts = ?, error = NULL WHERE msg_id = ?",
      [attempt, messageId],
    );
    try {
      const { path: pdfPath } = await pdfService.generateInvoicePdf(invoiceId);
      const mediaUrl = pdfService.createSignedPdfUrl(invoiceNo);
      const provider = getProvider();
      const summary =
        `${process.env.SHOP_NAME || "Billing System"} · Invoice ${invoiceNo} · ` +
        `INR ${Number(total).toFixed(2)} · ${itemCount} item${itemCount === 1 ? "" : "s"}. Thank you for your purchase.`;
      await provider.sendText(phone, summary);
      const documentResult = await provider.sendDocument(
        phone,
        mediaUrl,
        `Invoice ${invoiceNo}`,
      );
      if (!documentResult.providerMessageId) {
        throw new Error("WhatsApp provider did not return a document message ID");
      }
      await query(
        "CASHIER",
        `UPDATE whatsapp_messages
         SET status = 'SENT', provider_message_id = ?, error = NULL
         WHERE msg_id = ?`,
        [documentResult.providerMessageId, messageId],
      );
      console.info(
        `Invoice ${invoiceNo} PDF ready at ${pdfPath}; WhatsApp notification sent.`,
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await wait(retryDelays[attempt - 1]);
    }
  }
  await query(
    "CASHIER",
    "UPDATE whatsapp_messages SET status = 'FAILED', error = ? WHERE msg_id = ?",
    [String(lastError?.message || "WhatsApp delivery failed").slice(0, 2000), messageId],
  );
  logDeliveryFailure(invoiceId, lastError);
}

async function afterInvoicePaid(invoiceId) {
  const rows = await query(
    "CASHIER",
    `SELECT i.invoice_no AS invoiceNo, c.phone, c.whatsapp_opt_in AS whatsappOptIn,
            totals.grand_total AS grandTotal, COUNT(items.item_id) AS itemCount
     FROM invoices i
     JOIN customers c ON c.customer_id = i.customer_id
     JOIN v_invoice_totals totals ON totals.invoice_id = i.invoice_id
     LEFT JOIN invoice_items items ON items.invoice_id = i.invoice_id
     WHERE i.invoice_id = ? AND i.status = 'PAID'
     GROUP BY i.invoice_id, i.invoice_no, c.phone, c.whatsapp_opt_in, totals.grand_total`,
    [invoiceId],
  );
  if (!rows[0]) return null;

  const invoice = rows[0];
  let phone;
  try {
    phone = normalizeIndianPhone(invoice.phone);
  } catch (error) {
    const result = await query(
      "CASHIER",
      `INSERT INTO whatsapp_messages (invoice_id, to_number, status, error)
       VALUES (?, ?, 'FAILED', ?)`,
      [invoiceId, String(invoice.phone).slice(0, 13), error.message],
    );
    return result.insertId;
  }

  if (!invoice.whatsappOptIn) {
    const result = await query(
      "CASHIER",
      `INSERT INTO whatsapp_messages (invoice_id, to_number, status, error)
       VALUES (?, ?, 'FAILED', 'Customer opted out')`,
      [invoiceId, phone],
    );
    return result.insertId;
  }

  const result = await query(
    "CASHIER",
    "INSERT INTO whatsapp_messages (invoice_id, to_number, status) VALUES (?, ?, 'QUEUED')",
    [invoiceId, phone],
  );
  void deliver(
    result.insertId,
    invoiceId,
    phone,
    invoice.invoiceNo,
    invoice.grandTotal,
    Number(invoice.itemCount),
  ).catch((error) => logDeliveryFailure(invoiceId, error));
  return result.insertId;
}

module.exports = { afterInvoicePaid, deliver };
