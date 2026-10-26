# PHASE 5: Tests, Local Setup, Docs and Demo Script

**Goal:** make the project reliable, easy to run locally, and easy to present.

Read `00_README_and_shared_context.md` first. Phases 1 to 4 must be working.

## Step 1: Tests
- `database/tests.sql` (from Phase 1) still passes on a fresh database.
- Backend tests (Jest + supertest) in `backend/tests/`:
  - Auth: success, wrong password, lockout after 5 failures, inactive user.
  - RBAC matrix: for every role, call each admin-only route and assert 403; call without token and assert 401.
  - Row-level: customer cannot read another customer's invoice; cashier cannot read another cashier's invoice.
  - Invoice creation: success path, insufficient stock rollback, price snapshot unchanged after product price change.
  - Payment: partial then full payment moves status to PAID; loyalty points created.
  - Void: stock restored and points reversed.
  - PDF endpoint ownership; signed URL expiry and tamper rejection.
  - WhatsApp: mock provider records a message; retry logic marks FAILED after 3 attempts (mock a failing provider).
- `npm test` runs everything against a separate `billing_test` database (create it in a test setup script).

## Step 2: Security pass
Check and fix:
- All queries parameterized; no string-concatenated SQL.
- helmet, CORS limited to the frontend origin, login rate limiting.
- JWT secret and DB passwords only from env; `.env` in `.gitignore`.
- Passwords and password hashes never logged or returned by any endpoint.
- Demo buttons and the DB Permissions Demo are disabled when `DEMO_MODE=false`.
- Error responses never leak stack traces in production mode.

## Step 3: Lint and format
- ESLint + Prettier for backend and frontend; fix all errors.
- Remove unused code and console logs (keep intentional logging).

## Step 4: Local run scripts
- Add a root-level `package.json` with:
  - `db:setup`: runs `database/01_schema.sql` through `database/05_seed.sql`, in order, against local MySQL 8.
  - `dev:backend`: starts the backend development server.
  - `dev:frontend`: starts the frontend development server.
  - `dev`: runs both development servers with `concurrently`.
- Document local prerequisites, environment files, database setup, app start, and troubleshooting in `README.md`.

## Step 5: Documentation
- `README.md`: overview, feature list, architecture diagram (Mermaid), manual local setup, env variable table, Twilio sandbox setup, demo accounts, troubleshooting.
- `docs/architecture.md`: components, data flow for "create bill to WhatsApp" (Mermaid sequence diagram), why separate DB users per role.
- `docs/api.md`: endpoint table with method, path, role access, short description.
- `docs/permissions_matrix.md`: role vs action at app level and at DB GRANT level.
- `docs/demo-script.md`: a 5-minute walkthrough with exact steps and what to say:
  1. Login page, show role-based demo buttons.
  2. Cashier: scan or search products, add customer, apply coupon, pay by UPI, generate bill.
  3. Show WhatsApp message with PDF arriving on a real phone.
  4. Scan the invoice QR to open the verify page.
  5. Customer login: see own invoice, download PDF, loyalty tier.
  6. Admin: dashboard charts, void an invoice, show audit timeline and stock restored.
  7. DB Permissions Demo: same action as cashier vs admin side by side.
  Include a fallback plan if WhatsApp fails (switch to mock provider, show whatsapp log).
- `docs/viva_questions.md`: 15 likely questions with short answers (why triggers, why separate DB users, transactions and ACID in `sp_create_invoice`, why totals are in views, why price snapshot in invoice_items, how the signed URL works, how RBAC is enforced at two levels, etc.). Normalization questions can be added later.

## Step 6: Final verification
- Run tests, lint, and builds from a local MySQL 8 setup and list anything that does not work.
- Tag the repo `v1.0-demo`.

## Acceptance checklist
- [x] Backend tests pass — PASS: the isolated `billing_test` database was rebuilt; SQL regressions passed 10/10 and Jest passed 7 suites / 39 tests.
- [ ] Root `db:setup`, `dev:backend`, `dev:frontend`, and `dev` scripts start the local application — NOT VERIFIED: local database and frontend/backend startup need a fresh end-to-end verification.
- [ ] README lets a new person run the project in under 10 minutes — NOT VERIFIED: setup commands and troubleshooting are documented, but a fresh-clone timed run was not performed.
- [ ] Demo script rehearsed once end to end with real WhatsApp and once with mock — PARTIAL / BLOCKED: real delivery needs Twilio credentials, public HTTPS URLs, and a joined sandbox handset.
- [x] No secrets committed; `.env.example` complete — PASS: `.env` files are ignored and example files contain placeholders only.
