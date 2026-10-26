const twilio = require("twilio");

function createTwilioProvider() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } =
    process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    throw new Error("Twilio WhatsApp credentials are incomplete");
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  return {
    async sendText(to, text) {
      const message = await client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${to}`,
        body: text,
      });
      return { providerMessageId: message.sid, status: "SENT" };
    },
    async sendDocument(to, mediaUrl, caption) {
      const message = await client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${to}`,
        body: caption,
        mediaUrl: [mediaUrl],
      });
      return { providerMessageId: message.sid, status: "SENT" };
    },
  };
}

module.exports = { createTwilioProvider };
