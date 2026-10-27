# Ledgerline Billing Suite: Role-by-Role Demo Walkthrough

This is a hands-on script for demonstrating the cashier, customer, and admin workspaces. Follow the sections in order so the cashier creates an invoice that the customer can then see and download.

## Before the demo

### Start the app

1. Make sure local MySQL is running.
2. To keep the demo offline, set `WHATSAPP_PROVIDER=mock` in `backend/.env`. This records a mock notification in the app; it does **not** send a real WhatsApp message.
3. If the app is not already running, open a VS Code terminal at the project root and run:

   ```powershell
   npm run dev
   ```

4. Wait for Vite to show `http://localhost:5173/` and for the backend to report that it is listening. Open <http://localhost:5173>.

If the backend reports a database login error, check that `backend/.env` points to the local database port and that the three `DB_*_PASS` values match the MySQL role accounts. Do not paste credentials into chat or presentation notes.

### Demo accounts

| Role | Username | Password |
|---|---|---|
| Cashier | `cashier1` | `Cashier@123` |
| Customer | `priya` | `Customer@123` |
| Admin | `admin` | `Admin@123` |

These are seeded demo credentials, not production credentials.

### Demo plan

- Start with the cashier and create one paid invoice for Priya.
- Sign in as Priya and show that invoice in the customer portal; download its PDF.
- Sign in as admin and show reporting, invoice management, audit, stock, and database permission controls.
- Do not claim a real WhatsApp message was sent when using mock mode.

---

## 1. Cashier: create and pay an invoice

**Account:** `cashier1` / `Cashier@123`

### Sign in and introduce the POS

1. On the login screen, select **Cashier** under Quick Demo Access, or enter the cashier credentials above.
2. The app opens **Point of sale**. Point out the cashier workspace links:
   - **Point of sale**
   - **Today's invoices**
3. Briefly show that the catalog has product search, category filters, SKU lookup, prices, and stock counts.

**Say:** “The cashier can create and pay bills, but only has access to their own cashier workspace and invoices.”

### Select the customer

1. In the **Customer** section of the basket, type the seeded customer Priya's phone:

   ```text
   +919876543210
   ```

2. Click **Find**. Confirm that Priya is selected and her loyalty tier is shown.
3. If you have intentionally changed Priya's number in your local database, use that saved number instead.
4. If the app opens **Add customer**, stop and check the number and database before creating a duplicate. The seeded Priya record should already be present.

### Build a basket and apply a coupon

1. In **Search by name or SKU**, search for a stocked product such as **Basmati Rice 1kg**.
2. Click its product tile to add it to the basket. Use the `+` control to increase the quantity if needed.
3. Add enough products or quantity to make **subtotal plus tax at least ₹300**. This meets the seeded `WELCOME5` coupon minimum.
4. In **Discount code**, enter:

   ```text
   WELCOME5
   ```

5. Click **Apply**. Show the coupon discount and any loyalty-tier discount in the total breakdown.
6. Point out the subtotal, GST, discounts, and final amount due.

If the coupon is unavailable or the current basket is below the minimum, remove it or adjust the basket; do not hold up the demo.

### Record payment and show the result

1. Leave **One method** selected and choose **UPI** under Payment method. Cash is also fine for a demonstration.
2. Click **Generate bill** and wait for **PAYMENT COMPLETE**.
3. Show the invoice number, paid status, and total.
4. Click **Download PDF**. The invoice PDF should download in the browser's Downloads folder.
5. Optionally click **Print receipt** to show the print-friendly receipt.
6. If mock mode is enabled, describe the WhatsApp badge as a **mock notification status only**; it does not mean a message arrived on a phone.
7. Leave this invoice created for the customer section.

**Say:** “The invoice snapshots the item prices and tax, checks inventory during checkout, and records payment. The PDF is generated from the saved invoice.”

### Show cashier invoice history

1. Click **New bill** if still on the completion screen.
2. Open **Today's invoices** from the sidebar, or use the **View all** action on the POS.
3. Find the invoice just created and open it with the view icon.
4. Show the invoice details and **Download PDF** action.

---

## 2. Customer: view purchases and download the invoice

**Account:** `priya` / `Customer@123`

### Switch roles

1. Use the sign-out icon in the sidebar.
2. On the login page, select **Customer** under Quick Demo Access, or enter Priya's credentials.
3. Confirm that the customer lands on **My account** and has a customer-only navigation menu.

**Say:** “Customers see their own account and purchase history, not the cashier or admin tools.”

### Show profile and loyalty

1. Point out the profile card: name, phone, and address.
2. Point out the loyalty card: points, current tier, progress, and distance to the next tier.
3. Optionally open the edit-profile pencil to show the editable phone/address fields. Close without saving unless you intend to change the demo account.

### Show the invoice and download its PDF

1. Scroll to **Invoice history**.
2. Find the invoice the cashier just created. If the table has multiple entries, identify it by its invoice number, date, and amount from the cashier section.
3. Click **Details** to show the invoice items, tax, discounts, total, and payment status.
4. Click **Download PDF** in the history table (or **Download PDF** on the invoice detail page).
5. Open the downloaded PDF from the browser's Downloads folder. Point out the invoice number, customer, itemized charges, totals, and verification QR.
6. Optionally scan the QR code to open the invoice verification page.

**Say:** “The customer can retrieve their own invoice and verify it, while access to another customer's invoice is restricted.”

---

## 3. Admin: overview, management, and controls

**Account:** `admin` / `Admin@123`

### Open the admin overview

1. Sign out of Priya's account.
2. On the login page, select **Admin** under Quick Demo Access, or enter the admin credentials.
3. The app opens the admin **Overview** dashboard.
4. Show the summary cards:
   - Today's sales
   - Invoices today
   - Low stock alerts
   - Top cashier
5. Scroll through the sales charts, category performance, top products, stock alerts, and cashier rankings.
6. If the low-stock banner is visible, point out **Download reorder list (CSV)**. You may download it, but do not edit inventory during the demo.

### Review the cashier's invoice

1. Open **Invoices** in the sidebar.
2. Find the invoice created earlier. Admins can filter by status, date, and cashier.
3. Open it using the view icon.
4. Show the customer, cashier, itemized products, tax, discounts, payment, and invoice status.
5. Demonstrate **Download PDF** if you have not already downloaded it.
6. Do not click **Void invoice** in the main walkthrough; voiding changes business records. If you specifically need to demonstrate voiding, use a disposable invoice and explain that it reverses stock/loyalty effects.

### Show inventory and team controls

1. Open **Stock control** and show product quantities and reorder information. Avoid saving stock adjustments during the demo.
2. Open **Products** to show the catalog management surface.
3. Optionally show **Categories**, **Tax rates**, **Discounts**, and **Team & users** from the sidebar. For a short presentation, show the pages without changing or deleting records.

### Show audit history

1. Open **Audit timeline**.
2. Point out the actor, time, table/record, action, and before/after values.
3. Open **Audit log** if you want to show the filterable table view.
4. Explain that administrative changes and invoice events are recorded for review.

### Demonstrate database permissions safely

This page is available only when demo mode is enabled in the frontend.

1. Open **DB permissions demo**.
2. Leave **DELETE a product** selected and **Run as** set to `CASHIER`.
3. Click **Run sample**. Show the MySQL permission-denied result.
4. Change **Run as** to `ADMIN` and click **Run sample** again. Show the allowed result.
5. Point out that the UI reports the transaction was **Rolled back**. The sample action is designed not to persist a product deletion.

**Say:** “The application checks permissions, and MySQL role grants provide another enforcement layer. These fixed demo operations are rolled back.”

### Describe WhatsApp accurately

1. Open **WhatsApp log** only if you want to show notification records and their statuses.
2. Seeded records and mock-mode records are application examples, not proof of real delivery.
3. Say that live Twilio delivery is being configured separately. Do not claim a real customer received a message unless you verify it on the phone.

---

## Suggested closing

“The cashier creates and pays the bill; the customer can view only their own invoice and download its PDF; and the admin has store-wide reporting and management access. Invoice totals, role restrictions, and audit history are enforced across the application and database.”

## Quick recovery notes

- **Login fails:** confirm the backend is running and connected to the local MySQL database; recheck the username/password above.
- **The POS cannot find Priya:** use `+919876543210` unless you deliberately changed her saved phone.
- **The invoice is missing from Priya's portal:** confirm the cashier selected Priya's existing customer record, not a newly created duplicate.
- **PDF download fails:** make sure the invoice is paid and the backend is still running.
- **A WhatsApp notification shows FAILED:** continue the demo with the invoice and PDF; mock/Twilio delivery is separate from payment success.
- **DB permissions link is absent:** the frontend demo-mode flag may be disabled. Skip that step rather than changing configuration during the presentation.
