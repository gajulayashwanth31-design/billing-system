const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../src/app");
const errorHandler = require("../src/middleware/errorHandler");
const { closePools } = require("../src/config/db");

const secret = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const adminToken = jwt.sign(
  { userId: 1, username: "admin", role: "ADMIN" },
  secret,
);

describe("application security controls", () => {
  afterAll(async () => {
    await closePools();
  });

  test("uses security headers and limits CORS to the configured frontend origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://untrusted.example")
      .expect(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe(
      process.env.CORS_ORIGIN || "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-origin"]).not.toBe(
      "https://untrusted.example",
    );
  });

  test("rate limits repeated login attempts", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ username: `unknown-${attempt}`, password: "WrongPassword123" })
        .expect(401);
    }
    const limited = await request(app)
      .post("/api/auth/login")
      .send({ username: "unknown-final", password: "WrongPassword123" })
      .expect(429);

    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  test("disables the database permissions demo when DEMO_MODE is false", async () => {
    const previousMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "false";
    try {
      await request(app)
        .post("/api/demo/db-permissions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "CASHIER", action: "delete_product" })
        .expect(404);
    } finally {
      process.env.DEMO_MODE = previousMode;
    }
  });

  test("returns a generic production error without stack details", () => {
    const previousEnvironment = process.env.NODE_ENV;
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const response = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    process.env.NODE_ENV = "production";
    try {
      errorHandler(
        new Error("database password must not appear in responses"),
        {},
        response,
        jest.fn(),
      );
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
        },
      });
      expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
        "database password",
      );
    } finally {
      process.env.NODE_ENV = previousEnvironment;
      log.mockRestore();
    }
  });
});
