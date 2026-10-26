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
- [ ] Each role logs in and lands on the right page; cannot open other roles' routes by typing the URL
- [ ] Sidebar shows only allowed links per role
- [ ] Cashier can create a full bill end to end (customer lookup, cart, coupon, payment)
- [ ] Out-of-stock error from the backend shows a friendly toast
- [ ] Admin can add a product, adjust stock, and void an invoice; changes show up in the audit log
- [ ] Customer sees only their own invoices
- [ ] Dark and light mode both look fine

## Phase 4: Invoice PDF, WhatsApp Delivery and Demo-Wow Features
- [ ] Paying an invoice at the POS produces a PDF and a `whatsapp_messages` row
- [ ] With `WHATSAPP_PROVIDER=mock` the full flow works offline
- [ ] With Twilio sandbox + ngrok, a real WhatsApp message with the PDF arrives on a joined phone
- [ ] A failed send retries up to 3 times and shows FAILED in the UI; payment still succeeds
- [ ] Scanning the QR in the PDF opens the verify page and shows Authentic; changing the hash shows Invalid
- [ ] Customer can download only their own PDF (another invoice id returns 404)
- [ ] DB Permissions Demo shows "command denied" for cashier DELETE and success for admin, and nothing is permanently changed
- [ ] Tier discount shows identically in POS preview, saved invoice, and PDF

## Phase 5: Tests, Docker, Docs and Demo Script
- [ ] `npm test` passes in backend
- [ ] `docker compose up --build` gives a working app with seeded data
- [ ] README lets a new person run the project in under 10 minutes
- [ ] Demo script rehearsed once end to end with real WhatsApp and once with mock
- [ ] No secrets committed; `.env.example` complete
