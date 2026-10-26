# Architecture

## Components

```mermaid
flowchart TB
  subgraph Client
    Admin[Admin browser]
    Cashier[Cashier POS]
    Customer[Customer portal]
  end
  Admin -->|HTTPS / JSON + JWT| API
  Cashier -->|HTTPS / JSON + JWT| API
  Customer -->|HTTPS / JSON + JWT| API
  API[Express API<br/>Zod · RBAC · Helmet · rate limits]
  API --> CustomerPool[(billing_customer)]
  API --> CashierPool[(billing_cashier)]
  API --> AdminPool[(billing_admin)]
  CustomerPool --> MySQL[(MySQL 8)]
  CashierPool --> MySQL
  AdminPool --> MySQL
  API --> PDF[PDFKit + QRCode<br/>invoice storage]
  API --> Provider{WhatsApp provider}
  Provider --> Mock[Mock provider]
  Provider --> Twilio[Twilio WhatsApp]
  Twilio -->|Signed media fetch| API
  Twilio -->|Signed status callback| API
  Browser[React + Vite] --> API
```

## Create bill to WhatsApp data flow

```mermaid
sequenceDiagram
  actor Cashier
  participant UI as React POS
  participant API as Express API
  participant DB as MySQL
  participant PDF as PDF service
  participant WA as Mock / Twilio
  Cashier->>UI: Select customer, items, coupon, payment
  UI->>API: POST /api/invoices (JWT)
  API->>DB: Validate stock, snapshot price/tax, run sp_create_invoice
  DB-->>API: Invoice ID
  API-->>UI: Invoice totals from views
  UI->>API: POST /api/invoices/{id}/payments
  API->>DB: Run sp_record_payment
  DB-->>API: Paid status and loyalty effects
  API->>DB: Insert QUEUED whatsapp_messages row
  API-->>UI: Successful payment response
  par Asynchronous notification
    API->>PDF: Render PDF and verification/payment QR codes
    PDF-->>API: Saved invoice PDF
    API->>WA: Send summary, then PDF document
    WA-->>API: Provider message ID
    API->>DB: Store SENT / FAILED and attempt count
  end
  opt Twilio delivery updates
    WA->>API: POST signed status callback
    API->>DB: Update message status by provider ID
  end
  opt Twilio downloads PDF
    WA->>API: GET signed public PDF URL
    API->>DB: Verify invoice exists
    API-->>WA: PDF bytes (30-minute HMAC URL)
  end
```

Payment completion does not wait for WhatsApp delivery. The notification runs after the payment and stores its own queue, retry, and final-status state.

## Why separate database users

The API chooses a MySQL pool based on the authenticated role. `billing_customer` can read customer-facing invoice data and update only the allowed profile columns; `billing_cashier` can search catalog data, create invoices and payments through stored procedures, and send notifications, but cannot change prices or delete products; `billing_admin` can manage the full schema. Express authorization and row-scoped queries provide application-level checks, while MySQL grants provide an independent database boundary if an application check is bypassed. Totals are computed in views rather than stored, and invoice-item price/tax fields preserve the sale-time snapshot.
