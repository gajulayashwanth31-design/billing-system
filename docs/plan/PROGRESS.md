# Implementation Progress

## Phase 1: Database
- [x] Files run in order 01 to 05 on a fresh MySQL 8 without errors — PASS: loaded each script in order into a fresh MySQL 8.0.31 instance on port 3307.
- [x] Every table has at least 5 rows — PASS: queried all 15 table counts; smallest tables contain 5 rows.
- [x] `tests.sql` prints PASS for every trigger test — PASS: `mysql --execute="source database/tests.sql"` printed PASS for all 9 checks.
- [x] Cashier user gets "command denied" on DELETE/UPDATE products — PASS: both commands returned MySQL 1142 with the expected command-denied message.
- [x] `sp_create_invoice` rolls back fully when one item has insufficient stock — PASS: the test inserted one valid item before an insufficient-stock item; invoice count and stock were unchanged after rollback.
- [x] ER diagram renders in Markdown preview — PASS: Mermaid ER diagram syntax and all table relationships/attributes reviewed in `database/ER_DIAGRAM.md`.

## Phase 2: Backend (Express API)
- [x] Server starts, connects with all three pools — PASS: `node server.js` completed all three `pingPools`; `GET /health` returned 200.
- [x] Login works for admin, cashier, customer demo accounts; lockout works — PASS: all three demo logins returned 200; five wrong passwords then a correct password returned 401 while `locked_until > NOW()`.
- [x] Each negative test in `requests.http` returns the expected status code — PASS: no token 401, cashier product DELETE 403, foreign customer/cashier invoice 404, invalid phone 400, and insufficient stock 409 with trigger text.
- [x] A cashier cannot change product price even if the app-level check were bypassed (DB denies) — PASS: direct MySQL cashier UPDATE and DELETE both returned error 1142 `command denied`.
- [x] Creating an invoice with insufficient stock fails cleanly and stock is unchanged — PASS: API returned 409; exact before/after stock and invoice-count queries matched.
- [x] Creating an invoice, then a payment, flips status to PAID and creates loyalty points — PASS: a new invoice was paid in split payments; API returned PAID and SQL showed +1 loyalty point (then -1 on the subsequent void).
- [x] Swagger UI loads and lists all endpoints — PASS: `GET /api-docs/` returned 200; `GET /api-docs.json` returned 200 with 42 paths.

## Phase 3: Frontend (React)
- [x] Each role logs in and lands on the right page; cannot open other roles' routes by typing the URL — PASS: live browser smoke test confirmed admin `/admin`, cashier `/pos`, and customer `/portal`; cashier direct navigation to `/admin` redirected to `/403`.
- [x] Sidebar shows only allowed links per role — PASS: live browser smoke test confirmed each role's navigation was role-scoped.
- [x] Cashier can create a full bill end to end (customer lookup, cart, coupon, payment) — PASS: invoice 13 completed with customer lookup, `WELCOME5`, and payment; a separate invoice used split Cash/UPI payment.
- [x] Out-of-stock error from the backend shows a friendly toast — PASS: zero-stock submission returned HTTP 409 and displayed the backend message as a POS toast.
- [x] Admin can add a product, adjust stock, and void an invoice; changes show up in the audit log — PASS: product creation, stock adjustment, and invoice 15 void appeared in the audit log; void restored stock.
- [x] Customer sees only their own invoices — PASS: portal listed owned invoices; another customer's invoice returned 404.
- [x] Dark and light mode both look fine — PASS: both themes checked; no horizontal body overflow at 375px on the customer portal or on the admin mobile layout.
- [x] Frontend lint/build — PASS: `cd frontend; npm run lint; npm run build` (lint warnings and a large-chunk advisory only).
- [x] Backend lint/tests — PASS: `cd backend; npm run lint; npm test -- --runInBand` (11 tests passed).
- [x] Database regression tests — PASS: `mysql --protocol=TCP -h 127.0.0.1 -P 3307 -u root billing_db --execute="source E:/Projects/billing-system/database/tests.sql"` (all 9 checks passed).

## Phase 4: Invoice PDF, WhatsApp Delivery and Demo-Wow Features
- [x] Paying an invoice at the POS produces a PDF and a `whatsapp_messages` row — PASS: live invoice 29 payment generated its PDF and a SENT notification row.
- [x] With `WHATSAPP_PROVIDER=mock` the full flow works offline — PASS: invoice 29 completed with the mock provider, one send attempt, and no Twilio credentials.
- [ ] With Twilio sandbox + ngrok, a real WhatsApp message with the PDF arrives on a joined phone — BLOCKED: requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, a public `PUBLIC_BASE_URL`, and a joined sandbox handset.
- [x] A failed send retries up to 3 times and shows FAILED in the UI; payment still succeeds — PASS: `cd backend; npm test -- --runInBand` (21 tests) covered retries/payment isolation; browser invoice detail showed FAILED with the simulated provider error.
- [x] Scanning the QR in the PDF opens the verify page and shows Authentic; changing the hash shows Invalid — PASS: verification API accepted the authentic HMAC and rejected a modified hash; signed PDF returned 200 and tampered signature returned 403.
- [x] Customer can download only their own PDF (another invoice id returns 404) — PASS: customer PDF request returned 200 for an owned invoice and 404 for another customer's invoice.
- [x] DB Permissions Demo shows "command denied" for cashier DELETE and success for admin, and nothing is permanently changed — PASS: browser demo showed the MySQL denial/success and rollback behavior.
- [x] Tier discount shows identically in POS preview, saved invoice, and PDF — PASS: POS and saved invoice showed coupon ₹22.40, Silver discount ₹8.51, total ₹417.09; PDF generation uses the same persisted totals.
- [x] Audit timeline and low-stock feature — PASS: audit entries rendered in the timeline; low-stock banner/CSV action appeared when product 1 was temporarily set to zero, then its original stock (38) was restored.
- [x] Backend lint/tests, frontend lint/build, and database regression checks — PASS: backend lint; all 21 Jest tests; frontend lint/build; all 10 SQL checks. Frontend has existing lint warnings and Vite's large-chunk advisory only.

## Phase 5: Tests, Local Setup, Docs and Demo Script
- [x] `npm test` passes in backend — PASS: `cd backend; $env:TEST_DB_PORT='3307'; npm test` rebuilt the isolated `billing_test`; SQL regressions passed 10/10 and Jest passed 7 suites / 39 tests.
- [x] Root `db:setup`, `dev:backend`, `dev:frontend`, and `dev` scripts start the local application — PASS: `db:setup` initialized a temporary local MySQL 8 schema from SQL files 01–05 (22 tables, 5 seeded users); `npm run dev` started the backend (`/health` returned `ok`) and frontend (HTTP 200).
- [ ] README lets a new person run the project in under 10 minutes — NOT VERIFIED: setup paths, commands, environment variables, seeded credentials, and troubleshooting are documented in `README.md`, but a fresh-clone timed run was not performed.
- [ ] Demo script rehearsed once end to end with real WhatsApp and once with mock — PARTIAL / BLOCKED: the mock invoice-to-PDF/notification flow was exercised in Phase 4 and covered by the Phase 5 automated tests; a complete timed rehearsal of this script and real handset delivery remain unverified. Real delivery needs Twilio credentials, public HTTPS URLs, and a joined sandbox handset.
- [x] No secrets committed; `.env.example` complete — PASS: `.env` files are ignored; root and backend environment examples contain placeholders, and ignore rules cover `backend/storage/` and `dist/`.
