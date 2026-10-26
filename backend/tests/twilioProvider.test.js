jest.mock("twilio", () => jest.fn());

const twilio = require("twilio");
const {
  createTwilioProvider,
} = require("../src/services/whatsapp/TwilioProvider");

describe("Twilio WhatsApp provider", () => {
  const messagesCreate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = "test-account-sid";
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    process.env.PUBLIC_BASE_URL = "https://billing.example";
    twilio.mockReturnValue({ messages: { create: messagesCreate } });
    messagesCreate.mockResolvedValue({ sid: "SM123" });
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;
    delete process.env.PUBLIC_BASE_URL;
  });

  test("sends text using the configured sender and status callback", async () => {
    const provider = createTwilioProvider();
    const result = await provider.sendText("+919876543210", "Invoice ready");

    expect(twilio).toHaveBeenCalledWith(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    expect(messagesCreate).toHaveBeenCalledWith({
      from: "whatsapp:+14155238886",
      to: "whatsapp:+919876543210",
      body: "Invoice ready",
      statusCallback: "https://billing.example/api/webhooks/twilio/status",
    });
    expect(result).toEqual({ providerMessageId: "SM123", status: "SENT" });
  });

  test("sends PDF media and attaches the delivery callback", async () => {
    const provider = createTwilioProvider();
    const result = await provider.sendDocument(
      "+919876543210",
      "https://billing.example/invoice.pdf",
      "Invoice INV-1",
    );

    expect(messagesCreate).toHaveBeenCalledWith({
      from: "whatsapp:+14155238886",
      to: "whatsapp:+919876543210",
      body: "Invoice INV-1",
      mediaUrl: ["https://billing.example/invoice.pdf"],
      statusCallback: "https://billing.example/api/webhooks/twilio/status",
    });
    expect(result.providerMessageId).toBe("SM123");
  });
});
