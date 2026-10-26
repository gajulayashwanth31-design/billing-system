const crypto = require("crypto");

const signedUrlLifetimeSeconds = 30 * 60;

function signingSecret() {
  const secret = process.env.INVOICE_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "INVOICE_SIGNING_SECRET must be configured with at least 32 characters",
    );
  }
  return secret;
}

function hmac(value) {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(value)
    .digest("hex");
}

function verificationPayload(invoiceNo, grandTotal, createdAt) {
  const date =
    createdAt instanceof Date
      ? createdAt.toISOString().slice(0, 19).replace("T", " ")
      : String(createdAt).slice(0, 19).replace("T", " ");
  return `${invoiceNo}|${Number(grandTotal).toFixed(2)}|${date}`;
}

function createInvoiceHash(invoiceNo, grandTotal, createdAt) {
  return hmac(verificationPayload(invoiceNo, grandTotal, createdAt));
}

function isInvoiceHashValid(invoiceNo, grandTotal, createdAt, suppliedHash) {
  if (
    typeof suppliedHash !== "string" ||
    !/^[a-f\d]{64}$/i.test(suppliedHash)
  ) {
    return false;
  }
  const expected = Buffer.from(
    createInvoiceHash(invoiceNo, grandTotal, createdAt),
    "hex",
  );
  const actual = Buffer.from(suppliedHash, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function createSignedPdfUrl(invoiceNo, now = Math.floor(Date.now() / 1000)) {
  const baseUrl = (
    process.env.PUBLIC_BASE_URL || "http://localhost:4000"
  ).replace(/\/+$/, "");
  const expiresAt = now + signedUrlLifetimeSeconds;
  const signature = hmac(`${invoiceNo}|${expiresAt}`);
  return `${baseUrl}/public/invoices/${encodeURIComponent(invoiceNo)}.pdf?exp=${expiresAt}&sig=${signature}`;
}

function isSignedPdfRequestValid(invoiceNo, expiresAt, signature, now) {
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + signedUrlLifetimeSeconds ||
    typeof signature !== "string" ||
    !/^[a-f\d]{64}$/i.test(signature)
  ) {
    return false;
  }
  const expected = Buffer.from(hmac(`${invoiceNo}|${expiresAt}`), "hex");
  const actual = Buffer.from(signature, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

module.exports = {
  createInvoiceHash,
  createSignedPdfUrl,
  isInvoiceHashValid,
  isSignedPdfRequestValid,
  signedUrlLifetimeSeconds,
};
