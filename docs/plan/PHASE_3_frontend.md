# PHASE 3: Frontend (React)

**Goal:** a clean, modern, responsive React app in `/frontend` that works against the Phase 2 API, with a separate experience for each role.

Read `00_README_and_shared_context.md` first. Backend must be running.

## Step 1: Setup
- Vite + React, Tailwind CSS, React Router, Axios, Recharts, lucide-react icons, react-hot-toast.
- `.env.example`: `VITE_API_URL`, `VITE_DEMO_MODE`.
- Folders: `src/{api,components,context,pages,hooks,utils}`.
- Pick one accent colour, rounded cards, consistent spacing, dark/light mode toggle persisted in memory state (not localStorage if it breaks your environment; localStorage is fine in a normal Vite app).

## Step 2: Core plumbing
- `api/client.js`: Axios instance, attach JWT, on 401 clear session and redirect to `/login`, normalize error messages from the backend error format.
- `context/AuthContext.jsx`: login, logout, current user, role.
- `components/ProtectedRoute.jsx` with allowed roles; redirect to `/403` when role mismatch.
- `components/Layout`: role-based sidebar (only show links the role can use), topbar with user menu and theme toggle.
- Reusable components: DataTable (search, sort, pagination), Modal, ConfirmDialog, StatCard, StatusBadge, EmptyState, Skeleton, FormField with validation messages.

## Step 3: Pages

### Login (`/login`)
- Username and password form, validation, loading state, error toast.
- If `VITE_DEMO_MODE=true`, show three "Demo login" buttons (Admin / Cashier / Customer) that auto-fill and submit.
- After login redirect: CUSTOMER to `/portal`, CASHIER to `/pos`, ADMIN to `/admin`.

### Cashier POS (`/pos`)
- Left: product search box, category filter chips, product grid (name, price, stock badge; out-of-stock disabled). Optional barcode text input that adds by SKU on Enter.
- Right: cart with quantity +/- and remove, coupon code field with validate button, live subtotal / tax / discount / grand total (calculate with the same formulas as the DB views; the server is the source of truth).
- Customer section: lookup by phone, quick-add customer dialog, shows loyalty tier badge.
- Payment: method selector (Cash/UPI/Card/Split with amounts), "Generate Bill" button disabled until cart and customer are valid.
- After success: success screen with invoice number, totals, WhatsApp status badge (will be wired in Phase 4), print receipt button (print-friendly CSS), "New bill" button.
- Tab "Today's invoices": list with status badges and (later) "Resend on WhatsApp".

### Admin (`/admin/*`)
- Dashboard: StatCards (today's sales, invoices today, top cashier, low-stock count), charts (sales per day line, sales by category bar, payment split donut, top 5 products bar).
- Pages: Products (CRUD with category/tax dropdowns), Categories, Tax rates, Discounts, Users (create cashier, activate/deactivate, reset password), Invoices (filters by status/date/cashier, detail drawer, void with reason dialog), Stock adjustments, Audit log (table now; timeline UI in Phase 4), WhatsApp log.
- All tables: search, sort, pagination, loading skeleton, empty state.

### Customer portal (`/portal`)
- Profile card (edit phone and address only, other fields read-only).
- Invoice list (invoice no, date, total, status) and detail page.
- "Download PDF" button (disabled with tooltip until Phase 4).
- Loyalty points and tier badge with a progress bar to the next tier.

### Error pages
- `/403`, `/404`.

## Step 4: Quality
- Every button calls the real API; no hard-coded mock data (a mock fallback is allowed only behind an explicit `VITE_USE_MOCK=true` flag).
- No console errors or React key warnings.
- Mobile responsive down to 375px width for the customer portal and login; POS and admin should work on tablet width and above.

## Acceptance checklist
- [ ] Each role logs in and lands on the right page; cannot open other roles' routes by typing the URL
- [ ] Sidebar shows only allowed links per role
- [ ] Cashier can create a full bill end to end (customer lookup, cart, coupon, payment)
- [ ] Out-of-stock error from the backend shows a friendly toast
- [ ] Admin can add a product, adjust stock, and void an invoice; changes show up in the audit log
- [ ] Customer sees only their own invoices
- [ ] Dark and light mode both look fine
