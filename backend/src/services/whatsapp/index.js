const { createMockProvider } = require("./MockProvider");
const { createTwilioProvider } = require("./TwilioProvider");

function getProvider() {
  const requestedProvider = process.env.WHATSAPP_PROVIDER || "mock";
  const hasTwilioCredentials =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM;

  if (requestedProvider === "mock" || !hasTwilioCredentials) {
    return createMockProvider();
  }
  if (requestedProvider === "twilio") {
    return createTwilioProvider();
  }
  throw new Error(`Unsupported WHATSAPP_PROVIDER: ${requestedProvider}`);
}

module.exports = { getProvider };
