jest.mock("../src/services/whatsapp/MockProvider", () => ({
  createMockProvider: jest.fn(() => ({ name: "mock" })),
}));
jest.mock("../src/services/whatsapp/TwilioProvider", () => ({
  createTwilioProvider: jest.fn(() => ({ name: "twilio" })),
}));

const { createMockProvider } = require("../src/services/whatsapp/MockProvider");
const { createTwilioProvider } = require("../src/services/whatsapp/TwilioProvider");
const { getProvider } = require("../src/services/whatsapp");

describe("WhatsApp provider selection", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
    jest.clearAllMocks();
  });

  test("uses mock only when mock is explicitly selected or unset", () => {
    delete process.env.WHATSAPP_PROVIDER;
    expect(getProvider()).toEqual({ name: "mock" });
    process.env.WHATSAPP_PROVIDER = "mock";
    expect(getProvider()).toEqual({ name: "mock" });
    expect(createMockProvider).toHaveBeenCalledTimes(2);
  });

  test("does not silently use mock when Twilio credentials are missing", () => {
    process.env.WHATSAPP_PROVIDER = "twilio";
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;

    expect(() => getProvider()).toThrow("Twilio WhatsApp credentials are incomplete");
    expect(createMockProvider).not.toHaveBeenCalled();
  });

  test("uses Twilio when selected with configured credentials", () => {
    process.env.WHATSAPP_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "test-sid";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

    expect(getProvider()).toEqual({ name: "twilio" });
    expect(createTwilioProvider).toHaveBeenCalledTimes(1);
  });
});
