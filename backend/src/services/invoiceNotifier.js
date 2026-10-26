async function afterInvoicePaid(invoiceId) {
  console.info(
    `Invoice ${invoiceId} was paid; invoice notifications are not enabled until Phase 4.`,
  );
}

module.exports = { afterInvoicePaid };
