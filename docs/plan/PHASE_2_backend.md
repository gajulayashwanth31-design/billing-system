# PHASE 2: Backend (Express API)

**Goal:** a secure REST API in `/backend` that uses the Phase 1 database, with authentication, role-based access, per-role DB connection pools, and all business endpoints. PDF and WhatsApp come in Phase 4 (leave a stub).

Read `00_README_and_shared_context.md` first. Phase 1 database must be running and seeded.

## Step 1: Project setup
- `npm init`, install: express, mysql2, jsonwebtoken, bcrypt, zod, helmet, cors, express-rate-limit, dotenv, morgan, swagger-ui-express, yamljs (or swagger-jsdoc); dev: nodemon, jest, supertest, eslint, prettier.
- Scripts: `dev`, `start`, `test`, `lint`.
- Folders: `src/{config,routes,controllers,middleware,services,utils}`, `server.js`.
- `.env.example` with: PORT, JWT_SECRET, JWT_EXPIRES_IN, DB_HOST, DB_NAME, DB_CUSTOMER_USER/PASS, DB_CASHIER_USER/PASS, DB_ADMIN_USER/PASS, CORS_ORIGIN, DEMO_MODE, WHATSAPP_PROVIDER, PUBLIC_BASE_URL, UPI_ID, SHOP_NAME.

## Step 2: Database access (`config/db.js`)
- Create THREE mysql2 pools, one per role user.
- `getPool(role)` returns the pool for `CUSTOMER | CASHIER | ADMIN`.
- Helper `query(role, sql, params)` that always uses the role's pool. Controllers must never import a pool directly.

## Step 3: Auth
- `POST /api/auth/login`: check user active and not locked, compare bcrypt, on failure increment `failed_attempts` and lock for 5 minutes after 5 failures, on success reset counters and return `{ token, user: {id, username, role, customerId?} }`. Generic error "Invalid credentials".
- `GET /api/auth/me`, `POST /api/auth/change-password`.
- JWT payload: userId, role, customerId (if customer). Expiry 8h.
- Login uses the ADMIN pool internally for the auth lookup only (document why: the user is not authenticated yet).

## Step 4: Middleware (`src/middleware`)
- `authenticate` (verify JWT, attach `req.user`)
- `authorize(...roles)` (403 if role not allowed)
- `validate(schema)` using zod for body/query/params
- `rateLimiter` (strict on login)
- `errorHandler`: consistent JSON `{ error: { code, message, details? } }`; map MySQL SIGNAL errors (SQLSTATE 45000) to 409/422 with the trigger message; map "command denied" to 403.

## Step 5: Endpoints
Use the role access table from the README. Paginated lists accept `page`, `limit`, `search`, `sort`.

| Area | Endpoints | Roles |
|------|-----------|-------|
| Users | CRUD `/api/users`, activate/deactivate, reset password | ADMIN |
| Customers | GET/POST `/api/customers`, GET by phone `/api/customers/by-phone/:phone`, PUT | CASHIER, ADMIN |
| Categories, Tax rates | CRUD | read: CASHIER, ADMIN; write: ADMIN |
| Products | GET (search, category filter), CRUD | read: CASHIER, ADMIN; write: ADMIN |
| Stock | GET, PUT adjust (audited) | ADMIN |
| Discounts | CRUD, `POST /api/discounts/validate` | validate: CASHIER, ADMIN; CRUD: ADMIN |
| Invoices | POST (calls `sp_create_invoice`), GET list, GET by id | create: CASHIER, ADMIN; list: CASHIER sees own, ADMIN all |
| Invoice void | POST `/api/invoices/:id/void` with reason | ADMIN |
| Payments | POST `/api/invoices/:id/payments` (supports split payments) | CASHIER, ADMIN |
| Customer self-service | GET `/api/me/profile`, PUT (phone, address only), GET `/api/me/invoices`, GET `/api/me/invoices/:id`, GET `/api/me/loyalty` | CUSTOMER |
| Reports | `/api/reports/summary`, `/sales-by-day`, `/sales-by-category`, `/payment-split`, `/top-products`, `/top-cashiers`, `/low-stock` | ADMIN |
| Audit log | GET `/api/audit-log` (paginated, filter by table/user/date) | ADMIN |
| WhatsApp log | GET `/api/whatsapp-messages` | ADMIN |

Row-level rules enforced in SQL, not only in middleware:
- Customer can only read invoices where `customer_id` equals their own; otherwise return 404.
- Cashier list/detail only for invoices where `cashier_id` equals them.

Invoice detail response must include items, computed totals (from `v_invoice_totals`), payments and the WhatsApp delivery status.

## Step 6: Stubs for Phase 4
- `services/invoiceNotifier.js` with `afterInvoicePaid(invoiceId)` that currently just logs.
- Call it after the payment that makes an invoice PAID.
- Route placeholders for `GET /api/invoices/:id/pdf` and `POST /api/invoices/:id/resend-whatsapp` returning 501.

## Step 7: API docs and request collection
- Swagger UI at `/api-docs`.
- `backend/requests.http` containing every endpoint, plus negative tests: cashier DELETE product returns 403, customer reading another customer's invoice returns 404, no token returns 401, invalid input returns 400, insufficient stock returns 409/422 with a trigger message.

## Acceptance checklist
- [ ] Server starts, connects with all three pools
- [ ] Login works for admin, cashier, customer demo accounts; lockout works
- [ ] Each negative test in `requests.http` returns the expected status code
- [ ] A cashier cannot change product price even if the app-level check were bypassed (DB denies)
- [ ] Creating an invoice with insufficient stock fails cleanly and stock is unchanged
- [ ] Creating an invoice, then a payment, flips status to PAID and creates loyalty points
- [ ] Swagger UI loads and lists all endpoints
