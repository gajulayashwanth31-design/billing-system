process.env.JWT_SECRET ||= require("crypto").randomBytes(48).toString("hex");

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../src/app");

describe("Billing API middleware and documentation", () => {
  test("health endpoint is available", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  test("Swagger UI and OpenAPI document are available", async () => {
    const ui = await request(app).get("/api-docs/");
    const document = await request(app).get("/api-docs.json");
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("Swagger UI");
    expect(document.status).toBe(200);
    expect(
      document.body.paths["/api/invoices/{id}/payments"].post,
    ).toBeDefined();
  });

  test.each([
    ["/api/users", "get"],
    ["/api/customers", "get"],
    ["/api/stock", "get"],
    ["/api/payment-methods", "get"],
    ["/api/me/profile", "get"],
    ["/api/audit-log", "get"],
  ])("%s requires authentication", async (path, method) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  test("admin-only endpoint denies an authenticated customer", async () => {
    const token = jwt.sign(
      { userId: 1, username: "priya", role: "CUSTOMER", customerId: 1 },
      process.env.JWT_SECRET,
    );
    const response = await request(app)
      .get("/api/stock")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  test("login validates input before any database lookup", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "", password: "" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("payment amounts reject fractions of a paisa", async () => {
    const token = jwt.sign(
      { userId: 2, username: "cashier1", role: "CASHIER" },
      process.env.JWT_SECRET,
    );
    const response = await request(app)
      .post("/api/invoices/1/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({ methodId: 1, amount: 1.001 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
