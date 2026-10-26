# PHASE 1: Database

**Goal:** a complete, seeded, tested MySQL database in `/database` that already enforces the business rules (stock checks, immutability of paid invoices, auditing) and the role-based privileges.

Read `00_README_and_shared_context.md` first.

## Step 1: Schema (`01_schema.sql`)
Create database `billing_db` (utf8mb4). Tables, with PKs, FKs (explicit ON DELETE / ON UPDATE), UNIQUE, CHECK, NOT NULL, DEFAULT and useful indexes:

| Table | Key columns / notes |
|-------|--------------------|
| roles | role_id, role_name (CUSTOMER/CASHIER/ADMIN, unique) |
| users | user_id, username (unique), password_hash, role_id FK, is_active, failed_attempts, locked_until, created_at |
| customers | customer_id, user_id FK (nullable, unique), name, phone (unique, +91 format CHECK), email, address, whatsapp_opt_in, created_at |
| categories | category_id, name (unique) |
| tax_rates | tax_id, name (e.g. GST 5/12/18/28), rate_percent CHECK 0-100 |
| products | product_id, sku (unique), name, category_id FK, tax_id FK, price CHECK >= 0, reorder_level, is_active |
| stock | product_id PK/FK, quantity CHECK >= 0, updated_at |
| discounts | discount_id, code (unique), type (PERCENT/FLAT), value, valid_from, valid_to, min_bill_amount, is_active |
| payment_methods | method_id, name (Cash/UPI/Card/Wallet) |
| invoices | invoice_id, invoice_no (unique, like INV-2026-0001), customer_id FK, cashier_id FK (users), discount_id FK nullable, status (DRAFT/FINALIZED/PAID/VOID), created_at, void_reason, voided_by |
| invoice_items | item_id, invoice_id FK, product_id FK, quantity CHECK > 0, unit_price, tax_rate (snapshots) |
| payments | payment_id, invoice_id FK, method_id FK, amount CHECK > 0, paid_at, reference_no |
| loyalty_transactions | txn_id, customer_id FK, invoice_id FK, points (+/-), reason, created_at |
| whatsapp_messages | msg_id, invoice_id FK, to_number, status (QUEUED/SENT/DELIVERED/FAILED), provider_message_id, error, attempts, created_at, updated_at |
| audit_log | log_id, table_name, record_id, action, old_value (JSON), new_value (JSON), changed_by, changed_at |

Rules: never store line totals or invoice totals; those come from views.

## Step 2: Triggers (`02_triggers.sql`)
Write each trigger and a one-line comment explaining it:
1. `BEFORE INSERT ON invoice_items`: if stock quantity < new quantity, `SIGNAL SQLSTATE '45000'` with a clear message.
2. `AFTER INSERT ON invoice_items`: reduce `stock.quantity`.
3. `AFTER UPDATE ON products`: if price changed, write old/new to `audit_log`.
4. `AFTER UPDATE ON stock`: log manual stock adjustments to `audit_log`.
5. `BEFORE UPDATE ON invoices`: block changes when status is FINALIZED/PAID, except the VOID transition.
6. `BEFORE DELETE ON invoices`: always block (invoices are never hard-deleted).
7. `AFTER INSERT ON payments`: if sum(payments) >= invoice grand total, set invoice status PAID and insert loyalty points (1 point per 100 INR).
8. `AFTER UPDATE ON invoices` when status becomes VOID: restore stock and insert negative loyalty points.

## Step 3: Views and procedures (`03_views_procedures.sql`)
Views:
- `v_invoice_items_calc` (line subtotal, line tax, line total)
- `v_invoice_totals` (subtotal, tax, discount amount, grand total, paid amount, balance)
- `v_customer_tier` (lifetime spend and tier: Silver < 10k, Gold 10k-50k, Platinum > 50k)
- `v_daily_sales`, `v_sales_by_category`, `v_top_products`
- `v_low_stock` (quantity <= reorder_level)

Stored procedures:
- `sp_create_invoice(customer_id, cashier_id, discount_code, items_json, OUT invoice_id)` inside a transaction; loops through items_json, inserts invoice and items (price and tax snapshot from products), rolls back on any error.
- `sp_void_invoice(invoice_id, reason, user_id)`
- `sp_monthly_sales_report(year, month)`

## Step 4: Roles and grants (`04_roles_and_grants.sql`)
Create the three MySQL users (`billing_customer`, `billing_cashier`, `billing_admin`) with passwords read from placeholders and document them in `.env.example` later.
- `billing_customer`: SELECT on customers, invoices, invoice_items, payments, loyalty_transactions, products, v_invoice_totals, v_customer_tier; UPDATE (phone, address) on customers only.
- `billing_cashier`: SELECT on products, stock, categories, tax_rates, discounts, customers, invoices, invoice_items, payments, views; INSERT on customers, payments, whatsapp_messages; EXECUTE on sp_create_invoice; UPDATE on whatsapp_messages. No DELETE anywhere; no UPDATE on products.
- `billing_admin`: ALL PRIVILEGES on `billing_db`.
Add a commented "proof" section: commands to run as cashier that must fail (DELETE FROM products, UPDATE products SET price...) and the exact expected error text.

## Step 5: Seed data (`05_seed.sql`)
At least 5 rows in EVERY table. The `roles` table naturally has only 3 roles, so also add two spare roles (e.g. MANAGER, AUDITOR) that no user uses yet, and note this in a comment. Realistic data: 15 products across 5 categories, 5-8 customers with +91 numbers, 3 invoices already PAID, 1 DRAFT, 1 VOID so every status appears, payments with different methods, whatsapp_messages with different statuses. Seed users with bcrypt hashes from `backend/scripts/hash.js` (create that script now) for the demo accounts listed in the README.

## Step 6: Demo queries and tests
- `06_demo_queries.sql`: 10 queries showing joins, GROUP BY/HAVING, subqueries, one window function (rank customers by spend), and view usage.
- `tests.sql`: for each trigger, run a statement and print `PASS` or `FAIL` (insufficient stock blocked, stock reduced, price change audited, paid invoice update blocked, payment marks invoice PAID, void restores stock).
- `ER_DIAGRAM.md`: Mermaid ER diagram of all tables.
- `database/README.md`: exact commands to create the DB, run files in order, and verify row counts.

## Acceptance checklist
- [x] PASS — Files 01 to 05 ran in order on a fresh MySQL 8.0.31 instance (port 3307) without errors.
- [x] PASS — SQL row-count query confirmed every table has at least 5 rows.
- [x] PASS — `mysql --execute="source database/tests.sql"` printed PASS for all 9 trigger and rollback checks.
- [x] PASS — Cashier DELETE and UPDATE attempts each returned MySQL 1142 `command denied` for `products`.
- [x] PASS — Rollback test inserted one valid invoice item before the insufficient-stock item; invoice count and stock matched their original values.
- [x] PASS — Mermaid ER diagram reviewed in `database/ER_DIAGRAM.md`; all schema entities and foreign-key relationships are represented.
