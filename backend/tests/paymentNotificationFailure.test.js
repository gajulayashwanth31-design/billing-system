jest.mock("../src/config/db", () => ({
  callCreateInvoice: jest.fn(),
  callRecordPayment: jest.fn(),
  query: jest.fn(),
}));
jest.mock("../src/services/invoiceNotifier", () => ({
  afterInvoicePaid: jest.fn(),
}));

const { callRecordPayment, query } = require("../src/config/db");
const invoiceNotifier = require("../src/services/invoiceNotifier");
const { addPayment } = require("../src/controllers/invoicesController");

describe("payment result when WhatsApp queuing fails", () => {
  test("keeps the successful payment response when notification queuing rejects", async () => {
    query
      .mockResolvedValueOnce([{ invoice_id: 29, status: "DRAFT" }])
      .mockResolvedValueOnce([{ status: "PAID" }])
      .mockResolvedValueOnce([
        {
          id: 29,
          invoiceNo: "INV-2026-00000029",
          customerId: 1,
          cashierId: 2,
          status: "PAID",
          subtotal: 350,
          tax: 98,
          couponDiscountAmount: 22.4,
          tierDiscountAmount: 8.51,
          tierDiscountPercent: 2,
          discountAmount: 30.91,
          grandTotal: 417.09,
          paidAmount: 417.09,
          balance: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    callRecordPayment.mockResolvedValue(11);
    invoiceNotifier.afterInvoicePaid.mockRejectedValue(
      new Error("WhatsApp database unavailable"),
    );
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    const request = {
      validated: {
        params: { id: 29 },
        body: { methodId: 1, amount: 417.09 },
      },
      user: { role: "CASHIER", userId: 2, username: "cashier1" },
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await addPayment(request, response);

    expect(callRecordPayment).toHaveBeenCalledWith(
      "CASHIER",
      29,
      2,
      1,
      417.09,
      undefined,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json.mock.calls[0][0].data.status).toBe("PAID");
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
