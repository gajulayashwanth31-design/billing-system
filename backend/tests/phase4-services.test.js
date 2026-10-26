process.env.INVOICE_SIGNING_SECRET =
  "phase-four-test-signing-secret-with-32-characters";

const {
  createInvoiceHash,
  createSignedPdfUrl,
  isInvoiceHashValid,
  isSignedPdfRequestValid,
} = require("../src/services/invoiceSigning");
const { normalizeIndianPhone } = require("../src/services/whatsapp/phone");

describe("Indian WhatsApp phone normalization", () => {
  test.each([
    ["9876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIndianPhone(input)).toBe(expected);
  });

  test("rejects invalid mobile numbers", () => {
    expect(() => normalizeIndianPhone("1234567890")).toThrow(
      "valid Indian mobile number",
    );
  });
});

describe("invoice links and verification signatures", () => {
  const createdAt = "2026-10-26 12:34:56";

  test("detects modified invoice verification values", () => {
    const hash = createInvoiceHash("INV-2026-00000001", 212.8, createdAt);
    expect(
      isInvoiceHashValid("INV-2026-00000001", 212.8, createdAt, hash),
    ).toBe(true);
    expect(
      isInvoiceHashValid("INV-2026-00000001", 212.81, createdAt, hash),
    ).toBe(false);
  });

  test("limits signed invoice links to 30 minutes and rejects tampering", () => {
    const now = 1_800_000_000;
    const url = new URL(createSignedPdfUrl("INV-2026-00000001", now));
    const expiresAt = Number(url.searchParams.get("exp"));
    const signature = url.searchParams.get("sig");
    expect(expiresAt).toBe(now + 1800);
    expect(
      isSignedPdfRequestValid(
        "INV-2026-00000001",
        expiresAt,
        signature,
        now,
      ),
    ).toBe(true);
    expect(
      isSignedPdfRequestValid(
        "INV-2026-00000001",
        expiresAt,
        `${signature.slice(0, -1)}0`,
        now,
      ),
    ).toBe(false);
    expect(
      isSignedPdfRequestValid("INV-2026-00000001", expiresAt, signature, expiresAt),
    ).toBe(false);
  });
});
