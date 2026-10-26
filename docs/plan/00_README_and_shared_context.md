# Billing System: Implementation Plan (Index + Shared Context)

## How to use these files with GitHub Copilot
1. Open Copilot Chat in **Agent mode** with the whole `billing-system/` folder as the workspace.
2. Copy this folder's files into `billing-system/docs/plan/` so Copilot can read them.
3. For each phase, send Copilot this message (change the number):

```
Read docs/plan/00_README_and_shared_context.md and docs/plan/PHASE_1_database.md.
Implement Phase 1 completely, following the plan step by step.
Run everything yourself, fix errors, and tick off the acceptance checklist at the end of the phase file.
Do not start the next phase.
```

4. Verify the phase yourself, commit to git, then move to the next phase.

## Phase order
| Phase | File | Outcome |
|-------|------|---------|
| 1 | PHASE_1_database.md | Schema, triggers, views, procedures, grants, seed data |
| 2 | PHASE_2_backend.md | Express API with auth, RBAC, per-role DB pools |
| 3 | PHASE_3_frontend.md | React app: login, POS, admin dashboard, customer portal |
| 4 | PHASE_4_pdf_whatsapp_features.md | Invoice PDF, WhatsApp sending, unique demo features |
| 5 | PHASE_5_tests_local_setup_docs.md | Tests, local run scripts, README, demo script |

## Project overview
A billing system with three roles (CUSTOMER, CASHIER, ADMIN). Cashiers create bills at a POS screen; when an invoice is paid, a PDF invoice is generated and sent to the customer's WhatsApp number. Admins manage everything and see analytics. Customers see only their own invoices.

## Stack
- Database: MySQL 8 (triggers, views, stored procedures, GRANT-based users)
- Backend: Node.js + Express, mysql2, JWT, bcrypt, zod, helmet, express-rate-limit, dotenv
- Frontend: React + Vite + Tailwind CSS, React Router, Axios, Recharts
- PDF: pdfkit + qrcode
- WhatsApp: Twilio WhatsApp API (sandbox) behind a provider interface, plus a MOCK provider (env `WHATSAPP_PROVIDER=twilio|mock`)

## Target folder structure
```
billing-system/
  database/
    01_schema.sql
    02_triggers.sql
    03_views_procedures.sql
    04_roles_and_grants.sql
    05_seed.sql
    06_demo_queries.sql
    tests.sql
    ER_DIAGRAM.md
  backend/
    src/{config,routes,controllers,middleware,services,utils}
    server.js
    .env.example
    storage/invoices/
  frontend/
    src/{api,components,context,pages,hooks,utils}
  docs/
    plan/            (these phase files)
    architecture.md
    api.md
    permissions_matrix.md
    demo-script.md
  README.md
```

## Roles and permissions (the source of truth)
| Action | CUSTOMER | CASHIER | ADMIN |
|--------|:--------:|:-------:|:-----:|
| View own profile, edit phone/address | yes | no | no |
| View own invoices, download own PDF | yes | no | no |
| View loyalty points | yes (own) | view | view |
| Search products | no | yes | yes |
| Create customer | no | yes | yes |
| Create invoice, accept payment | no | yes | yes |
| View invoices | no | only ones they created | all |
| Resend invoice on WhatsApp | no | yes | yes |
| Create/edit/delete products, categories, tax, discounts | no | no | yes |
| Void invoice | no | no | yes |
| Manage users | no | no | yes |
| Reports, audit log, WhatsApp log | no | no | yes |

Enforce at BOTH levels:
- App level: Express RBAC middleware on every route, plus row-level checks in queries.
- DB level: three MySQL users `billing_customer`, `billing_cashier`, `billing_admin` with least-privilege GRANTs. The backend uses the connection pool that matches the logged-in user's role.

## Global rules
- Parameterized queries only. Validate all input with zod.
- No secrets in code; everything through `.env` (provide `.env.example`).
- Currency INR, GST taxes, Indian names and `+91` phone numbers in seed data.
- Sensible table design (keys, foreign keys, constraints). Do not store derived values like line totals or invoice totals; compute them in views. Formal normalization docs are NOT needed right now.
- `invoice_items` stores `unit_price` and `tax_rate` at the time of sale (price snapshot).
- Keep code readable, comment only non-obvious logic.
- After each phase: run it, fix errors, summarize what was built and how to verify it.

## Demo accounts (seed these in Phase 1; passwords for demo only)
| Role | Username | Password |
|------|----------|----------|
| ADMIN | admin | Admin@123 |
| CASHIER | cashier1 | Cashier@123 |
| CASHIER | cashier2 | Cashier@123 |
| CUSTOMER | one account per linked customer, e.g. priya | Customer@123 |
(Store only bcrypt hashes in the SQL seed; generate them with a small script and put the script in `backend/scripts/hash.js`.)
