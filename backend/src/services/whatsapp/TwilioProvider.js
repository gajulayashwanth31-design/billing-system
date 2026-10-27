const twilio = require("twilio");

function createTwilioProvider() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } =
    process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    throw new Error("Twilio WhatsApp credentials are incomplete");
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const statusCallback = publicBaseUrl
    ? `${publicBaseUrl}/api/webhooks/twilio/status`
    : undefined;

  return {
    async sendText(to, text) {
      const message = await client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${to}`,
        body: text,
        ...(statusCallback ? { statusCallback } : {}),
      });
      return {
        providerMessageId: message.sid,
        status: message.status,
      };
    },
    async sendDocument(to, mediaUrl, caption) {
      const message = await client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${to}`,
        body: caption,
        mediaUrl: [mediaUrl],
        ...(statusCallback ? { statusCallback } : {}),
      });
      return {
        providerMessageId: message.sid,
        status: message.status,
      };
    },
    async getMessageStatus(messageSid) {
      const message = await client.messages(messageSid).fetch();
      return {
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    },
  };
}

module.exports = { createTwilioProvider };
