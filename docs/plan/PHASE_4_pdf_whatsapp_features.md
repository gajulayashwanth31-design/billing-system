# PHASE 4: Invoice PDF, WhatsApp Delivery and Demo-Wow Features

**Goal:** when an invoice is paid, generate a professional PDF and send it to the customer's WhatsApp, then add the unique features that make the demo stand out.

Read `00_README_and_shared_context.md` first. Phases 1 to 3 must be working.

## Part A: Invoice PDF (`services/pdfService.js`)
- Use pdfkit. Layout: shop name/address/GSTIN header, invoice number and date, cashier name, customer name and phone, itemized table (item, qty, rate, tax %, amount), subtotal, discount, tax, grand total, payment status and method(s), footer thank-you note.
- Two QR codes (qrcode package):
  1. UPI pay QR: `upi://pay?pa=<UPI_ID>&pn=<SHOP_NAME>&am=<balance>&cu=INR&tn=<invoice_no>` (shown only if balance > 0).
  2. Verification QR linking to `<PUBLIC_BASE_URL>/verify/<invoice_no>?h=<hash>`.
- Save to `backend/storage/invoices/<invoice_no>.pdf`; regenerate if the file is missing.
- `GET /api/invoices/:id/pdf`: CUSTOMER only for own invoices, CASHIER only for own, ADMIN any. Streams the PDF.
- Wire the "Download PDF" buttons in the customer portal, POS success screen, and admin invoice detail.

## Part B: WhatsApp (`services/whatsapp/`)
Files: `index.js` (provider selector), `TwilioProvider.js`, `MockProvider.js`, `phone.js`.
- Common interface: `sendText(to, text)` and `sendDocument(to, mediaUrl, caption)`, both returning `{ providerMessageId, status }`.
- `TwilioProvider`: uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (like `whatsapp:+14155238886`). Sends to `whatsapp:+91XXXXXXXXXX`.
- `MockProvider`: logs to console, returns a fake id, status SENT. Selected when `WHATSAPP_PROVIDER=mock` or when Twilio env vars are missing.
- `phone.js`: normalize any Indian number (10 digits, with or without +91/0) to E.164.
- Signed public PDF URL: `GET /public/invoices/:invoiceNo.pdf?exp=<unix>&sig=<hmac>`; HMAC of invoiceNo + exp with a secret; reject expired or invalid; expiry 30 minutes. Twilio fetches the PDF from this URL, so `PUBLIC_BASE_URL` must be a public address (ngrok in local dev).
- `invoiceNotifier.afterInvoicePaid(invoiceId)` (replace the stub):
  1. Check `customers.whatsapp_opt_in`; if false, record a message row with status FAILED and error "Customer opted out" and stop.
  2. Generate PDF, create a `whatsapp_messages` row (QUEUED).
  3. Send a text summary (shop, invoice no, amount, number of items, thank you) and then the PDF as a document.
  4. Update the row to SENT with the provider message id; on failure set error and retry up to 3 times with exponential backoff (2s, 4s, 8s) and increment `attempts`; final failure sets FAILED.
  5. Never let a WhatsApp failure roll back or fail the payment request; run it asynchronously.
- `POST /api/invoices/:id/resend-whatsapp` (CASHIER own invoices, ADMIN any).
- `POST /api/webhooks/twilio/status` to update delivery status (DELIVERED/READ/FAILED) by provider message id; validate Twilio signature when `TWILIO_AUTH_TOKEN` is set.
- UI: StatusBadge (queued/sent/delivered/failed) in the POS success screen, invoice detail, and admin WhatsApp log; "Resend on WhatsApp" button with loading state and toast.

## Part C: Unique features
1. **Verify Invoice page** (public, no login): `/verify/:invoiceNo?h=<hash>`. Backend endpoint `GET /api/public/verify/:invoiceNo?h=` recomputes an HMAC over invoice number, grand total and date. Show a green "Authentic invoice" card with amount, date and shop, or a red "Invalid or tampered invoice" card.
2. **DB Permissions Demo** (admin only, visible only if `DEMO_MODE=true`): a page with a whitelist of fixed sample actions (SELECT products, UPDATE product price, DELETE a product, INSERT an invoice, SELECT audit_log). A "Run as" selector (customer / cashier / admin) executes the action using that role's DB pool and shows the real MySQL result or the real "command denied" error in a side-by-side table. Never accept SQL from the client; destructive samples must run inside a transaction that is always rolled back.
3. **Loyalty tiers with auto discount**: use `v_customer_tier`; apply 2% / 5% / 8% for Silver / Gold / Platinum as a line on the invoice (implement through the discount logic in `sp_create_invoice` or as a computed extra discount, keep it consistent between POS preview and server totals).
4. **Audit timeline**: admin page rendering `audit_log` as a vertical timeline (who, when, table, old to new value highlighted).
5. **Low-stock banner**: admin dashboard banner from `v_low_stock` with a "Download reorder list (CSV)" button.
6. **Optional bonus**: inbound WhatsApp webhook; if a customer texts "BILL", reply with their latest invoice PDF; "POINTS" replies with loyalty points.

## Acceptance checklist
- [x] Paying an invoice at the POS produces a PDF and a `whatsapp_messages` row — PASS: live POS payment created invoice 29; its PDF was generated and its notification row reached SENT.
- [x] With `WHATSAPP_PROVIDER=mock` the full flow works offline — PASS: the live mock-provider flow completed without Twilio credentials; invoice 29's notification reached SENT on attempt 1.
- [ ] With Twilio sandbox + ngrok, a real WhatsApp message with the PDF arrives on a joined phone — BLOCKED: this environment has no Twilio credentials, public ngrok URL, or joined sandbox handset. To verify, configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `PUBLIC_BASE_URL`, and a joined phone.
- [x] A failed send retries up to 3 times and shows FAILED in the UI; payment still succeeds — PASS: `cd backend; npm test -- --runInBand` (21 tests) verifies four total attempts and payment success when notification queuing fails; the live admin invoice detail rendered FAILED and the simulated failure text.
- [x] Scanning the QR in the PDF opens the verify page and shows Authentic; changing the hash shows Invalid — PASS: public verification accepted the invoice's authentic HMAC and rejected a tampered hash; signed PDF returned 200 and a tampered signature returned 403.
- [x] Customer can download only their own PDF (another invoice id returns 404) — PASS: authenticated customer PDF request returned 200 for their invoice and 404 for another customer's invoice; admin and signed PDF requests also returned valid PDFs.
- [x] DB Permissions Demo shows "command denied" for cashier DELETE and success for admin, and nothing is permanently changed — PASS: browser demo displayed the real cashier MySQL denial and admin success; both demo transactions rolled back.
- [x] Tier discount shows identically in POS preview, saved invoice, and PDF — PASS: POS and saved invoice showed coupon ₹22.40, Silver 2% discount ₹8.51, and total ₹417.09; PDF generation uses those saved invoice discount fields.

Additional feature checks:
- Audit timeline rendered invoice/stock audit entries in the admin browser.
- Low-stock banner and CSV action rendered after setting product 1 to zero stock; the original quantity (38) was restored after the check.
- `cd backend; npm run lint`, `cd frontend; npm run lint; npm run build`, and `database/tests.sql` all passed. Frontend lint/build report existing lint warnings and a large-chunk advisory only.
