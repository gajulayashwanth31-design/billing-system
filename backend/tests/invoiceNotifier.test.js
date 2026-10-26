jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/services/pdfService", () => ({
  generateInvoicePdf: jest.fn(),
  createSignedPdfUrl: jest.fn(),
}));
jest.mock("../src/services/whatsapp", () => ({ getProvider: jest.fn() }));

const { query } = require("../src/config/db");
const { getProvider } = require("../src/services/whatsapp");
const { deliver } = require("../src/services/invoiceNotifier");

describe("invoice WhatsApp delivery retry behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require("../src/services/pdfService").generateInvoicePdf.mockResolvedValue({
      path: "test-invoice.pdf",
    });
    require("../src/services/pdfService").createSignedPdfUrl.mockReturnValue(
      "https://billing.example/public/invoices/INV-1.pdf?exp=123&sig=abc",
    );
    query.mockResolvedValue({});
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("retries transient failures three times before marking delivery SENT", async () => {
    const provider = {
      sendText: jest
        .fn()
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockResolvedValue({ providerMessageId: "text-1", status: "SENT" }),
      sendDocument: jest
        .fn()
        .mockResolvedValue({ providerMessageId: "document-1", status: "SENT" }),
    };
    getProvider.mockReturnValue(provider);

    const completion = deliver(
      5,
      29,
      "+919876543210",
      "INV-2026-00000029",
      417.09,
      1,
    );
    await completion;

    expect(provider.sendText).toHaveBeenCalledTimes(4);
    expect(provider.sendDocument).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      "CASHIER",
      expect.stringContaining("SET status = 'SENT'"),
      ["document-1", 5],
    );
  }, 20000);

  test("marks delivery FAILED after four unsuccessful attempts", async () => {
    const provider = {
      sendText: jest.fn().mockRejectedValue(new Error("provider unavailable")),
      sendDocument: jest.fn(),
    };
    getProvider.mockReturnValue(provider);

    const completion = deliver(
      6,
      30,
      "+919876543210",
      "INV-2026-00000030",
      100,
      1,
    );
    await completion;

    expect(provider.sendText).toHaveBeenCalledTimes(4);
    expect(provider.sendDocument).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      "CASHIER",
      expect.stringContaining("SET status = 'FAILED'"),
      ["provider unavailable", 6],
    );
  }, 20000);
});
