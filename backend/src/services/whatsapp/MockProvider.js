const crypto = require("crypto");

function createMockProvider() {
  return {
    async sendText(to, text) {
      console.info(`[WhatsApp mock] Text queued for ${to}: ${text}`);
      return {
        providerMessageId: `mock-${crypto.randomUUID()}`,
        status: "SENT",
      };
    },
    async sendDocument(to, mediaUrl, caption) {
      console.info(
        `[WhatsApp mock] Document queued for ${to} (${caption}); URL configured: ${Boolean(mediaUrl)}`,
      );
      return {
        providerMessageId: `mock-${crypto.randomUUID()}`,
        status: "SENT",
      };
    },
  };
}

module.exports = { createMockProvider };
