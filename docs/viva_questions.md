# Viva questions and short answers

1. **Why use triggers for stock changes?** Invoice-item inserts and voids can adjust stock consistently even when they are initiated by different API paths; the database remains the final invariant boundary.
2. **Why use stored procedures for invoice creation?** The procedure validates and reserves stock, snapshots sale prices/tax, and commits or rolls back the entire invoice operation.
3. **What makes the invoice procedure atomic?** It starts a transaction and has a SQL exception handler that rolls back before rethrowing the database error.
4. **Why use separate MySQL users per role?** A compromised or incorrectly authorized cashier request cannot gain product-price write or delete privileges merely because the API process has database connectivity.
5. **Why are totals calculated in views?** Subtotals, tax, discounts, paid amount, and balance are derived from invoice items and payments; storing duplicates can make them inconsistent.
6. **Why snapshot `unit_price` and `tax_rate` on each invoice item?** A later catalog price or tax change must not change the historical customer's bill.
7. **How is row-level access enforced?** Middleware checks role, then customer/cashier invoice queries include the authenticated user's customer or cashier ID.
8. **Why use Zod?** Request payloads, URL parameters, and query parameters are checked against explicit schemas before reaching controllers and SQL.
9. **How are SQL injection risks reduced?** Values use prepared statements; dynamic sort/order SQL is chosen only from fixed allowlists.
10. **How does invoice verification work?** The server computes an HMAC over invoice number, grand total, and creation date, then compares it with the QR's hash using a timing-safe comparison.
11. **Why is the public PDF link signed and expiring?** An HMAC limits access to a specific invoice and expiry time; the server rejects modified or expired query parameters.
12. **How is a Twilio status callback authenticated?** When a Twilio auth token is configured, the API validates the provider's request signature before updating a message row.
13. **Why does payment succeed if WhatsApp fails?** Payment is committed first; notification is queued asynchronously, retried, and its errors are recorded without rolling back the paid invoice.
14. **What happens to stock and loyalty points when an invoice is voided?** The void procedure changes invoice status and triggers restore sold stock and write reversing loyalty transactions.
15. **Why is the DB permissions demo safe?** The browser submits only a fixed role/action selection; server-side SQL is whitelisted and every demonstration transaction is rolled back.
