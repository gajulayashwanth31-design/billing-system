# API reference

Base URL: `http://localhost:4000`. Protected routes require `Authorization: Bearer <JWT>`. Request bodies and query parameters are validated by Zod. The live OpenAPI/Swagger document is available at `/api-docs/` and `/api-docs.json`.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Authenticate a seeded or managed user. |
| GET | `/api/auth/me` | Authenticated | Return the current token identity. |
| POST | `/api/auth/change-password` | Authenticated | Change the caller's password. |
| GET, POST | `/api/users` | ADMIN | List or create users. |
| GET, PUT, DELETE | `/api/users/{id}` | ADMIN | Get, update, or deactivate a user. |
| POST | `/api/users/{id}/activate` | ADMIN | Activate a user. |
| POST | `/api/users/{id}/deactivate` | ADMIN | Deactivate a user. |
| POST | `/api/users/{id}/reset-password` | ADMIN | Reset a user password. |
| GET, POST | `/api/customers` | CASHIER, ADMIN | Search or create customers. |
| GET | `/api/customers/by-phone/{phone}` | CASHIER, ADMIN | Find a customer by Indian E.164 phone number. |
| PUT | `/api/customers/{id}` | CASHIER, ADMIN | Update permitted customer fields. |
| GET | `/api/categories` | CASHIER, ADMIN | List categories. |
| POST | `/api/categories` | ADMIN | Create a category. |
| GET, PUT, DELETE | `/api/categories/{id}` | GET: CASHIER, ADMIN; write: ADMIN | Get, update, or remove a category. |
| GET | `/api/tax-rates` | CASHIER, ADMIN | List tax rates. |
| POST | `/api/tax-rates` | ADMIN | Create a tax rate. |
| GET, PUT, DELETE | `/api/tax-rates/{id}` | GET: CASHIER, ADMIN; write: ADMIN | Get, update, or remove a tax rate. |
| GET | `/api/products` | CASHIER, ADMIN | Search products. |
| POST | `/api/products` | ADMIN | Create a product and initial stock. |
| GET, PUT, DELETE | `/api/products/{id}` | GET: CASHIER, ADMIN; write: ADMIN | Get, update, or deactivate a product. |
| GET | `/api/stock` | ADMIN | List product stock. |
| PUT | `/api/stock/{productId}` | ADMIN | Adjust on-hand quantity. |
| GET | `/api/payment-methods` | CASHIER, ADMIN | List payment methods. |
| GET | `/api/discounts` | CASHIER, ADMIN | List active/available discounts. |
| POST | `/api/discounts` | ADMIN | Create a discount. |
| GET, PUT, DELETE | `/api/discounts/{id}` | GET: CASHIER, ADMIN; write: ADMIN | Get, update, or remove a discount. |
| POST | `/api/discounts/validate` | CASHIER, ADMIN | Validate a coupon against a bill amount. |
| GET, POST | `/api/invoices` | CASHIER, ADMIN | List invoices or create one with stock and price snapshots. |
| GET | `/api/invoices/{id}` | CASHIER, ADMIN | Read an invoice; cashiers see only their own. |
| POST | `/api/invoices/{id}/payments` | CASHIER, ADMIN | Record full or partial payment. |
| POST | `/api/invoices/{id}/void` | ADMIN | Void an invoice with a reason and reverse inventory/points. |
| GET | `/api/invoices/{id}/pdf` | CUSTOMER, CASHIER, ADMIN | Download a PDF subject to invoice ownership. |
| POST | `/api/invoices/{id}/resend-whatsapp` | CASHIER, ADMIN | Queue a notification for a paid invoice. |
| GET, PUT | `/api/me/profile` | CUSTOMER | Read or update own profile phone/address. |
| GET | `/api/me/invoices` | CUSTOMER | List the caller's invoices. |
| GET | `/api/me/invoices/{id}` | CUSTOMER | Read the caller's invoice. |
| GET | `/api/me/loyalty` | CUSTOMER | Read own loyalty balance and tier. |
| GET | `/api/reports/summary` | ADMIN | Dashboard totals and low-stock count. |
| GET | `/api/reports/sales-by-day` | ADMIN | Daily sales summary. |
| GET | `/api/reports/sales-by-category` | ADMIN | Category sales summary. |
| GET | `/api/reports/payment-split` | ADMIN | Payment-method totals. |
| GET | `/api/reports/top-products` | ADMIN | Top-selling products. |
| GET | `/api/reports/top-cashiers` | ADMIN | Cashier sales totals. |
| GET | `/api/reports/low-stock` | ADMIN | Products at or below reorder level. |
| GET | `/api/audit-log` | ADMIN | Search the audit log. |
| GET | `/api/whatsapp-messages` | ADMIN | List notification status, attempts, and errors. |
| GET | `/api/public/verify/{invoiceNo}?h={hash}` | Public | Verify the signed invoice number/amount/date tuple. |
| GET | `/public/invoices/{invoiceNo}.pdf?exp={unix}&sig={hmac}` | Public, signed | Fetch a PDF through a 30-minute HMAC URL. |
| POST | `/api/webhooks/twilio/status` | Public, signature-checked when configured | Update Twilio delivery status by provider message ID. |
| POST | `/api/demo/db-permissions` | ADMIN, `DEMO_MODE=true` | Run one fixed, rollback-only permissions sample. |
| GET | `/health` | Public | Liveness check. |
| GET | `/api-docs/`, `/api-docs.json` | Public | Swagger UI and OpenAPI specification. |

Authentication does not replace ownership checks: customer and cashier invoice routes are also scoped to their linked customer/cashier IDs.
