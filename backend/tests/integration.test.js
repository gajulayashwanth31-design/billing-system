const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../src/app");
const { closePools, query } = require("../src/config/db");
const {
  createInvoiceHash,
  createSignedPdfUrl,
} = require("../src/services/invoiceSigning");

const secret = process.env.JWT_SECRET;
const adminToken = token("ADMIN", 1);
const cashierToken = token("CASHIER", 2);
const otherCashierToken = token("CASHIER", 3);
const customerToken = token("CUSTOMER", 4, 1);
const otherCustomerToken = token("CUSTOMER", 5, 2);

let paidInvoice;

function token(role, userId, customerId) {
  return jwt.sign(
    {
      userId,
      username: role === "CUSTOMER" ? "priya" : role.toLowerCase(),
      role,
      ...(customerId ? { customerId } : {}),
    },
    secret,
  );
}

function authorized(tokenValue, method, url) {
  return request(app)[method](url).set("Authorization", `Bearer ${tokenValue}`);
}

async function createInvoice(items = [{ product_id: 1, quantity: 1 }]) {
  const response = await authorized(cashierToken, "post", "/api/invoices")
    .send({ customerId: 1, items })
    .expect(201);
  return response.body.data;
}

async function payInvoice(
  invoice,
  amount = invoice.balance ?? invoice.grandTotal,
) {
  return authorized(
    cashierToken,
    "post",
    `/api/invoices/${invoice.id}/payments`,
  )
    .send({ methodId: 1, amount: Number(amount).toFixed(2) })
    .expect(201);
}

async function waitForMessage(invoiceId) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const rows = await query(
      "ADMIN",
      "SELECT status, provider_message_id AS providerMessageId, attempts FROM whatsapp_messages WHERE invoice_id = ? ORDER BY msg_id DESC LIMIT 1",
      [invoiceId],
    );
    if (rows[0] && ["SENT", "DELIVERED", "FAILED"].includes(rows[0].status)) {
      return rows[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error(
    `WhatsApp notification for invoice ${invoiceId} did not finish`,
  );
}

const adminOnlyRoutes = [
  ["get", "/api/users"],
  ["get", "/api/users/1"],
  ["post", "/api/users"],
  ["put", "/api/users/1"],
  ["post", "/api/users/1/activate"],
  ["post", "/api/users/1/deactivate"],
  ["post", "/api/users/1/reset-password"],
  ["delete", "/api/users/1"],
  ["post", "/api/products"],
  ["put", "/api/products/1"],
  ["delete", "/api/products/1"],
  ["post", "/api/categories"],
  ["put", "/api/categories/1"],
  ["delete", "/api/categories/1"],
  ["post", "/api/tax-rates"],
  ["put", "/api/tax-rates/1"],
  ["delete", "/api/tax-rates/1"],
  ["post", "/api/discounts"],
  ["put", "/api/discounts/1"],
  ["delete", "/api/discounts/1"],
  ["get", "/api/stock"],
  ["put", "/api/stock/1"],
  ["get", "/api/reports/summary"],
  ["get", "/api/reports/sales-by-day"],
  ["get", "/api/reports/sales-by-category"],
  ["get", "/api/reports/payment-split"],
  ["get", "/api/reports/top-products"],
  ["get", "/api/reports/top-cashiers"],
  ["get", "/api/reports/low-stock"],
  ["get", "/api/audit-log"],
  ["get", "/api/whatsapp-messages"],
  ["post", "/api/demo/db-permissions"],
  ["post", "/api/invoices/1/void"],
];

describe("database-backed API integration", () => {
  afterAll(async () => {
    await closePools();
  });

  test("authenticates seeded users and never returns password hashes", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "Admin@123" })
      .expect(200);

    expect(response.body.user).toMatchObject({
      username: "admin",
      role: "ADMIN",
    });
    expect(response.body.token).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(
      /password_hash|\$2[aby]\$/,
    );

    const users = await authorized(adminToken, "get", "/api/users").expect(200);
    expect(JSON.stringify(users.body)).not.toMatch(/password_hash|\$2[aby]\$/);
  });

  test("rejects a wrong password without returning account data", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "WrongPassword123" })
      .expect(401);
    const users = await query(
      "ADMIN",
      "SELECT failed_attempts FROM users WHERE user_id = 1",
    );

    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(users[0].failed_attempts).toBe(1);
    expect(JSON.stringify(response.body)).not.toMatch(
      /password_hash|\$2[aby]\$/,
    );
    await query(
      "ADMIN",
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = 1",
    );
  });

  test("locks an account after five failed passwords", async () => {
    await query(
      "ADMIN",
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = 1",
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ username: "admin", password: "WrongPassword123" })
        .expect(401);
    }
    const users = await query(
      "ADMIN",
      "SELECT failed_attempts, locked_until > NOW() AS locked FROM users WHERE user_id = 1",
    );
    expect(users[0].failed_attempts).toBe(5);
    expect(Boolean(users[0].locked)).toBe(true);
    await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "Admin@123" })
      .expect(401);
    await query(
      "ADMIN",
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = 1",
    );
  });

  test("rejects inactive accounts without incrementing failed attempts", async () => {
    await query(
      "ADMIN",
      "UPDATE users SET is_active = FALSE, failed_attempts = 2 WHERE user_id = 4",
    );
    try {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ username: "priya", password: "Customer@123" })
        .expect(401);
      const users = await query(
        "ADMIN",
        "SELECT is_active, failed_attempts FROM users WHERE user_id = 4",
      );
      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(users[0]).toMatchObject({ is_active: 0, failed_attempts: 2 });
    } finally {
      await query(
        "ADMIN",
        "UPDATE users SET is_active = TRUE, failed_attempts = 0, locked_until = NULL WHERE user_id = 4",
      );
    }
  });

  test("returns 401 without a token and 403 for non-admin roles on every admin-only route", async () => {
    for (const [method, url] of adminOnlyRoutes) {
      await request(app)[method](url).expect(401);
      for (const roleToken of [cashierToken, customerToken]) {
        await authorized(roleToken, method, url).expect(403);
      }
    }
  });

  test("enforces customer and cashier invoice row ownership", async () => {
    await authorized(customerToken, "get", "/api/me/invoices/1").expect(200);
    await authorized(otherCustomerToken, "get", "/api/me/invoices/1").expect(
      404,
    );
    await authorized(cashierToken, "get", "/api/invoices/3").expect(404);
    await authorized(otherCashierToken, "get", "/api/invoices/1").expect(404);
  });

  test("treats search input as a value rather than executable SQL", async () => {
    const response = await authorized(cashierToken, "get", "/api/products")
      .query({ search: "' OR 1=1 --" })
      .expect(200);

    expect(response.body.data).toHaveLength(0);
  });

  test("creates invoices, rolls back insufficient stock, and preserves price snapshots", async () => {
    const invoice = await createInvoice();
    expect(invoice.items[0].unitPrice).toBe(120);

    const before = await query(
      "ADMIN",
      `SELECT s.quantity, (SELECT COUNT(*) FROM invoices) AS invoiceCount
       FROM stock s WHERE s.product_id = 1`,
    );
    const failure = await authorized(cashierToken, "post", "/api/invoices")
      .send({ customerId: 1, items: [{ product_id: 1, quantity: 10000 }] })
      .expect(409);
    const after = await query(
      "ADMIN",
      `SELECT s.quantity, (SELECT COUNT(*) FROM invoices) AS invoiceCount
       FROM stock s WHERE s.product_id = 1`,
    );
    expect(failure.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(after[0]).toEqual(before[0]);

    try {
      await authorized(adminToken, "put", "/api/products/1")
        .send({ price: 999 })
        .expect(200);
      const details = await authorized(
        cashierToken,
        "get",
        `/api/invoices/${invoice.id}`,
      ).expect(200);
      expect(details.body.data.items[0].unitPrice).toBe(120);
    } finally {
      await authorized(adminToken, "put", "/api/products/1")
        .send({ price: 120 })
        .expect(200);
    }
  });

  test("records partial and full payments, awards loyalty, and delivers a mock PDF notification", async () => {
    const invoice = await createInvoice([{ product_id: 2, quantity: 1 }]);
    await payInvoice(invoice, 10);
    const partial = await authorized(
      cashierToken,
      "get",
      `/api/invoices/${invoice.id}`,
    ).expect(200);
    expect(partial.body.data.status).not.toBe("PAID");
    expect(Number(partial.body.data.paidAmount)).toBe(10);

    const completed = await payInvoice(invoice, partial.body.data.balance);
    paidInvoice = completed.body.data;
    expect(paidInvoice.status).toBe("PAID");
    expect(Number(paidInvoice.balance)).toBe(0);

    const points = await query(
      "ADMIN",
      "SELECT SUM(points) AS points FROM loyalty_transactions WHERE invoice_id = ?",
      [invoice.id],
    );
    expect(Number(points[0].points)).toBeGreaterThan(0);

    const message = await waitForMessage(invoice.id);
    expect(message.status).toBe("SENT");
    expect(message.attempts).toBe(1);
    expect(message.providerMessageId).toMatch(/^mock-/);
    expect(
      fs.existsSync(
        path.join(
          process.env.INVOICE_STORAGE_DIR ||
            path.join(__dirname, "..", "storage", "invoices"),
          `${paidInvoice.invoiceNo}.pdf`,
        ),
      ),
    ).toBe(true);
  }, 15000);

  test("void restores stock and reverses loyalty points", async () => {
    const before = await query(
      "ADMIN",
      "SELECT quantity FROM stock WHERE product_id = 3",
    );
    const invoice = await createInvoice([{ product_id: 3, quantity: 1 }]);
    await payInvoice(invoice);
    const afterSale = await query(
      "ADMIN",
      "SELECT quantity FROM stock WHERE product_id = 3",
    );
    expect(afterSale[0].quantity).toBe(before[0].quantity - 1);

    await authorized(adminToken, "post", `/api/invoices/${invoice.id}/void`)
      .send({ reason: "Integration test rollback" })
      .expect(200);
    const restored = await query(
      "ADMIN",
      "SELECT quantity FROM stock WHERE product_id = 3",
    );
    const points = await query(
      "ADMIN",
      "SELECT SUM(points) AS points FROM loyalty_transactions WHERE invoice_id = ?",
      [invoice.id],
    );
    expect(restored[0].quantity).toBe(before[0].quantity);
    expect(Number(points[0].points)).toBe(0);
  });

  test("serves PDFs only to authorized users and rejects expired or tampered links", async () => {
    expect(paidInvoice).toBeDefined();
    await authorized(
      customerToken,
      "get",
      `/api/invoices/${paidInvoice.id}/pdf`,
    )
      .expect("Content-Type", /application\/pdf/)
      .expect(200);
    await authorized(
      otherCustomerToken,
      "get",
      `/api/invoices/${paidInvoice.id}/pdf`,
    ).expect(404);
    await authorized(
      otherCashierToken,
      "get",
      `/api/invoices/${paidInvoice.id}/pdf`,
    ).expect(404);
    await authorized(
      adminToken,
      "get",
      `/api/invoices/${paidInvoice.id}/pdf`,
    ).expect(200);

    const signedUrl = new URL(createSignedPdfUrl(paidInvoice.invoiceNo));
    const signedPath = `${signedUrl.pathname}${signedUrl.search}`;
    await request(app)
      .get(signedPath)
      .expect("Content-Type", /application\/pdf/)
      .expect(200);
    signedUrl.searchParams.set("sig", "0".repeat(64));
    await request(app)
      .get(`${signedUrl.pathname}${signedUrl.search}`)
      .expect(403);
    await request(app)
      .get(
        `/public/invoices/${paidInvoice.invoiceNo}.pdf?exp=1&sig=${"0".repeat(64)}`,
      )
      .expect(403);
  });

  test("verifies invoice authenticity and rejects a modified hash", async () => {
    expect(paidInvoice).toBeDefined();
    const rows = await query(
      "ADMIN",
      `SELECT invoice_no AS invoiceNo,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
              grand_total AS grandTotal
       FROM invoices JOIN v_invoice_totals USING (invoice_id)
       WHERE invoice_id = ?`,
      [paidInvoice.id],
    );
    const invoice = rows[0];
    const hash = createInvoiceHash(
      invoice.invoiceNo,
      invoice.grandTotal,
      invoice.createdAt,
    );
    const valid = await request(app)
      .get(`/api/public/verify/${invoice.invoiceNo}`)
      .query({ h: hash })
      .expect(200);
    expect(valid.body.data.valid).toBe(true);
    const tampered = await request(app)
      .get(`/api/public/verify/${invoice.invoiceNo}`)
      .query({ h: `${hash.slice(0, -1)}${hash.endsWith("0") ? "1" : "0"}` })
      .expect(200);
    expect(tampered.body.data.valid).toBe(false);
  });
});
