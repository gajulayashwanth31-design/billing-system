const twilio = require("twilio");
const { query } = require("../config/db");
const { HttpError } = require("../utils/errors");

function isValidSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true;
  const signature = req.get("x-twilio-signature");
  if (!signature) return false;
  const baseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const webhookUrl = `${baseUrl}/api/webhooks/twilio/status`;
  return twilio.validateRequest(authToken, signature, webhookUrl, req.body);
}

async function status(req, res) {
  if (!isValidSignature(req)) {
    throw new HttpError(
      403,
      "TWILIO_SIGNATURE_INVALID",
      "Twilio signature validation failed",
    );
  }
  const { MessageSid, MessageStatus, ErrorMessage } = req.validated.body;
  const normalizedStatus =
    MessageStatus === "delivered" || MessageStatus === "read"
      ? "DELIVERED"
      : MessageStatus === "failed" || MessageStatus === "undelivered"
        ? "FAILED"
        : "SENT";
  await query(
    "ADMIN",
    `UPDATE whatsapp_messages
     SET status = ?, error = CASE WHEN ? = 'FAILED' THEN ? ELSE error END
     WHERE provider_message_id = ?`,
    [
      normalizedStatus,
      normalizedStatus,
      ErrorMessage || `Twilio status: ${MessageStatus}`,
      MessageSid,
    ],
  );
  return res.sendStatus(204);
}

module.exports = { status };
