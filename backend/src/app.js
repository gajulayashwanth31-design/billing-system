const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const openapiDocument = require("./openapi");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const customerRoutes = require("./routes/customerRoutes");
const createCatalogRouter = require("./routes/catalogRoutes");
const stockRoutes = require("./routes/stockRoutes");
const discountRoutes = require("./routes/discountRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const customerPortalRoutes = require("./routes/customerPortalRoutes");
const reportRoutes = require("./routes/reportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentMethodRoutes = require("./routes/paymentMethodRoutes");
const publicInvoiceRoutes = require("./routes/publicInvoiceRoutes");
const signedInvoicePdfRoutes = require("./routes/signedInvoicePdfRoutes");
const twilioWebhookRoutes = require("./routes/twilioWebhookRoutes");
const dbPermissionsRoutes = require("./routes/dbPermissionsRoutes");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/api-docs.json", (req, res) => res.json(openapiDocument));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));
app.use("/api/auth", authRoutes);
app.use("/api/public", publicInvoiceRoutes);
app.use("/public/invoices", signedInvoicePdfRoutes);
app.use("/api/webhooks/twilio", twilioWebhookRoutes);
app.use("/api/demo", dbPermissionsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/categories", createCatalogRouter("categories"));
app.use("/api/tax-rates", createCatalogRouter("tax-rates"));
app.use("/api/products", createCatalogRouter("products"));
app.use("/api/stock", stockRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/me", customerPortalRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", adminRoutes);

app.use((req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } });
});
app.use(errorHandler);

module.exports = app;
