const { createMockProvider } = require("./MockProvider");
const { createTwilioProvider } = require("./TwilioProvider");

function getProvider() {
  const requestedProvider = process.env.WHATSAPP_PROVIDER || "mock";
  const hasTwilioCredentials =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM;

  if (requestedProvider === "mock") {
    return createMockProvider();
  }
  if (requestedProvider === "twilio") {
    if (!hasTwilioCredentials) {
      throw new Error(
        "Twilio WhatsApp credentials are incomplete. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in backend/.env.",
      );
    }
    return createTwilioProvider();
  }
  throw new Error(`Unsupported WHATSAPP_PROVIDER: ${requestedProvider}`);
}

module.exports = { getProvider };
