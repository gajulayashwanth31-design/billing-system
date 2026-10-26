# Five-minute demo walkthrough

Use the seeded data in a local or Compose demo. The seeded credentials are public demo credentials and must not be reused in production.

## 1. Login and role boundaries (30 seconds)

Open <http://localhost:5173>. Show the demo login shortcuts and explain that each role receives a different navigation menu and API/database permissions. Sign in as `cashier1` / `Cashier@123`.

## 2. Create and pay a bill (90 seconds)

1. On the POS screen, look up Priya at `+919876543210`.
2. Search for **Dark Chocolate 100g** and add two units.
3. Apply `WELCOME5`. Point out the coupon discount, Silver loyalty discount, and final amount in the total preview.
4. Choose UPI (or another available payment method) and generate/pay the bill.
5. Show the paid status, the PDF button, and the WhatsApp status badge.

Suggested narration: “The database procedure snapshots the current price and tax, checks stock inside a transaction, and the totals view calculates tax and discounts. Payment is recorded separately from asynchronous notification delivery.”

## 3. Show the WhatsApp result (35 seconds)

With Twilio configured, open the WhatsApp log and show the message arriving on the joined handset with its invoice PDF. If a real handset or public tunnel is unavailable, leave `WHATSAPP_PROVIDER=mock`, show the SENT status in the invoice detail/log, and explain that the mock provider exercises the same queue and PDF flow without sending externally.

## 4. Verify the invoice QR (35 seconds)

Open the generated PDF, scan the verification QR, and show the green **Authentic invoice** result. Change one character in the `h` query parameter and reload to show **Invalid or tampered invoice**. The QR uses a server HMAC over invoice number, amount, and date.

## 5. Customer portal (40 seconds)

Sign out and sign in as `priya` / `Customer@123`. Show her invoice, PDF download, and loyalty balance. Explain that another customer's invoice ID is scoped out and returns 404.

## 6. Admin inventory and audit timeline (50 seconds)

Sign out and sign in as `admin` / `Admin@123`. Show dashboard sales and low-stock alert, then the invoice audit timeline. If demonstrating void, create a disposable paid invoice first, void it with a reason, and show that the audit event is recorded and stock/points are reversed.

## 7. Database permission boundary (40 seconds)

Open **DB permissions demo**. Run `delete_product` as CASHIER, then as ADMIN. Show the real MySQL permission-denied result versus success, and point out that both sample transactions roll back so no seeded product is permanently changed.

## Fallback if WhatsApp fails

Use the admin WhatsApp log to show the final status and retry count. For a presentation without Twilio connectivity, set `WHATSAPP_PROVIDER=mock`, restart the backend, create/pay a disposable invoice, and show the PDF plus SENT mock notification. Do not claim that a real phone received a message when only the mock provider was used.
