# Permissions matrix

`C` = CUSTOMER, `K` = CASHIER, `A` = ADMIN. App-level checks use the verified JWT role plus row filters. Database permissions are configured in `database/04_roles_and_grants.sql`.

| Action | App: C | App: K | App: A | Database boundary |
| --- | :---: | :---: | :---: | --- |
| View/edit own profile phone and address | Yes | No | No | `billing_customer` may update only `phone` and `address`; controller is scoped to the token customer ID. |
| View own invoices, payments, and PDF | Own rows | No | All invoices | Customer grants are read-only; API adds customer ownership scope before PDF generation. |
| View loyalty | Own balance | Yes | Yes | Customer, cashier, and admin have appropriate reads; customer API uses its linked customer ID. |
| Search products/categories/tax and payment methods | No | Yes | Yes | Cashier/customer/admin have only the listed `SELECT` grants. |
| Create/update customer records | No | Yes | Yes | Cashier can create and update allowed customer fields; customer self-service remains limited to phone/address. |
| Create invoice and record payment | No | Own cashier invoices | Yes | Cashier executes `sp_create_invoice` / `sp_record_payment`; stored procedures and triggers enforce stock, payment, and audit invariants. |
| Read invoice list/detail | No | Own cashier invoices | All | Cashier app queries include `cashier_id`; customer query includes `customer_id`; admin uses its pool. |
| Resend invoice on WhatsApp | No | Own cashier invoices | All | Cashier may insert/update notification rows; invoice ownership is checked in the controller. |
| Manage products, categories, tax rates, discounts, stock | No | No | Yes | Cashier has no product-price update, DELETE, or stock-adjust grants; admin has schema-wide privileges. |
| Manage users and deactivate/void invoices | No | No | Yes | Admin-only routes and admin DB pool; void uses the stored procedure to reverse stock/points. |
| Reports, audit log, WhatsApp log | No | No | Yes | Read permissions for cashier are restricted to operational views; audit/log reads use admin pool. |
| DB permissions demo | No | No | Yes, only when `DEMO_MODE=true` | Only fixed actions are accepted; each sample runs in a transaction that is rolled back. |

## MySQL grant summary

| DB account | Intended grant scope |
| --- | --- |
| `billing_customer` | SELECT customer-facing records, invoice views, payment methods, loyalty, and products; UPDATE only customer phone/address. |
| `billing_cashier` | SELECT operational catalog/invoice/report views; INSERT/UPDATE customer fields, payments, and WhatsApp messages; EXECUTE invoice/payment procedures. No product price writes or deletes. |
| `billing_admin` | Full privileges on `billing_db.*`. |

The SQL scripts use `CHANGE_ME_*_PASSWORD` values for a fresh demo. Replace those placeholders and the corresponding environment values together before deployment. Application-role grants are not a substitute for parameterized queries or Zod validation.
