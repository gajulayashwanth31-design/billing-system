USE billing_db;

INSERT INTO roles (role_id, role_name) VALUES
  (1, 'CUSTOMER'), (2, 'CASHIER'), (3, 'ADMIN'),
  -- MANAGER and AUDITOR are reserved roles with no assigned users.
  (4, 'MANAGER'), (5, 'AUDITOR');

-- Password hashes are bcrypt hashes produced by backend/scripts/hash.js.
INSERT INTO users (user_id, username, password_hash, role_id, is_active) VALUES
  (1, 'admin', '$2b$10$1FIBdGYVafvw0HSy46LOiez5WB.BCaC8HEVGaDXKKLDhH3FGbkhY6', 3, TRUE),
  (2, 'cashier1', '$2b$10$nBDMVtqZn9C0GjkhFzVZc.0ovUrYu1u0S/8tOQJeXfxKmHCrhbk/C', 2, TRUE),
  (3, 'cashier2', '$2b$10$.fKMY9DHsLGi8V6SzlA7t.JSyNC3HMx1MAhRnaVADLbjNXzfCFi1K', 2, TRUE),
  (4, 'priya', '$2b$10$ovjvINFIhhKF1QAz/eY/JOuO0FWc6fnIyCPeD3tsljClnbXy3TwNO', 1, TRUE),
  (5, 'rahul', '$2b$10$B76dtaH9nvmE35V5oQZpd.Yd2d8JAmegvoRvERLmR88LHOR.psgaW', 1, TRUE);

INSERT INTO customers (customer_id, user_id, name, phone, email, address, whatsapp_opt_in) VALUES
  (1, 4, 'Priya Sharma', '+919876543210', 'priya@example.in', '12 MG Road, Bengaluru', TRUE),
  (2, 5, 'Rahul Verma', '+919876543211', 'rahul@example.in', '24 Park Street, Kolkata', TRUE),
  (3, NULL, 'Ananya Iyer', '+919876543212', 'ananya@example.in', '5 Anna Salai, Chennai', TRUE),
  (4, NULL, 'Arjun Patel', '+919876543213', 'arjun@example.in', '18 CG Road, Ahmedabad', FALSE),
  (5, NULL, 'Meera Nair', '+919876543214', 'meera@example.in', '7 Marine Drive, Kochi', TRUE),
  (6, NULL, 'Kabir Singh', '+919876543215', 'kabir@example.in', '31 Banjara Hills, Hyderabad', TRUE),
  (7, NULL, 'Isha Desai', '+919876543216', 'isha@example.in', '9 FC Road, Pune', FALSE);

INSERT INTO categories (category_id, name) VALUES
  (1, 'Groceries'), (2, 'Beverages'), (3, 'Personal Care'),
  (4, 'Household'), (5, 'Snacks');

INSERT INTO tax_rates (tax_id, name, rate_percent) VALUES
  (1, 'GST 0%', 0.00), (2, 'GST 5%', 5.00), (3, 'GST 12%', 12.00),
  (4, 'GST 18%', 18.00), (5, 'GST 28%', 28.00);

INSERT INTO products (product_id, sku, name, category_id, tax_id, price, reorder_level) VALUES
  (1, 'GRO-001', 'Basmati Rice 1kg', 1, 2, 120.00, 10),
  (2, 'GRO-002', 'Toor Dal 1kg', 1, 2, 145.00, 8),
  (3, 'GRO-003', 'Whole Wheat Atta 5kg', 1, 2, 265.00, 6),
  (4, 'BEV-001', 'Filter Coffee 250g', 2, 3, 210.00, 7),
  (5, 'BEV-002', 'Masala Tea 250g', 2, 2, 155.00, 7),
  (6, 'BEV-003', 'Mango Juice 1L', 2, 3, 110.00, 8),
  (7, 'PER-001', 'Neem Soap 3-pack', 3, 3, 72.00, 10),
  (8, 'PER-002', 'Herbal Shampoo 200ml', 3, 4, 185.00, 5),
  (9, 'PER-003', 'Toothpaste 150g', 3, 4, 98.00, 8),
  (10, 'HOU-001', 'Dishwash Liquid 500ml', 4, 4, 135.00, 6),
  (11, 'HOU-002', 'Laundry Detergent 1kg', 4, 3, 175.00, 6),
  (12, 'HOU-003', 'Kitchen Towels 2-pack', 4, 4, 89.00, 5),
  (13, 'SNK-001', 'Roasted Cashews 200g', 5, 5, 320.00, 5),
  (14, 'SNK-002', 'Spiced Murukku 250g', 5, 3, 125.00, 8),
  (15, 'SNK-003', 'Dark Chocolate 100g', 5, 5, 175.00, 5);

INSERT INTO stock (product_id, quantity) VALUES
  (1, 40), (2, 35), (3, 25), (4, 30), (5, 32),
  (6, 28), (7, 38), (8, 24), (9, 31), (10, 22),
  (11, 20), (12, 18), (13, 16), (14, 27), (15, 21);

INSERT INTO discounts (discount_id, code, type, value, valid_from, valid_to, min_bill_amount) VALUES
  (1, 'WELCOME5', 'PERCENT', 5.00, '2020-01-01 00:00:00', '2035-12-31 23:59:59', 300.00),
  (2, 'SAVE50', 'FLAT', 50.00, '2020-01-01 00:00:00', '2035-12-31 23:59:59', 500.00),
  (3, 'FESTIVE10', 'PERCENT', 10.00, '2020-01-01 00:00:00', '2035-12-31 23:59:59', 1000.00),
  (4, 'BULK100', 'FLAT', 100.00, '2020-01-01 00:00:00', '2035-12-31 23:59:59', 2000.00),
  (5, 'VIP3', 'PERCENT', 3.00, '2020-01-01 00:00:00', '2035-12-31 23:59:59', 0.00);

INSERT INTO payment_methods (method_id, name) VALUES
  (1, 'Cash'), (2, 'UPI'), (3, 'Card'), (4, 'Wallet'), (5, 'Bank Transfer');

INSERT INTO invoices (invoice_id, invoice_no, customer_id, cashier_id, discount_id, status, created_at, void_reason, voided_by) VALUES
  (1, 'INV-2026-00000001', 1, 2, NULL, 'PAID', '2026-10-20 10:15:00', NULL, NULL),
  (2, 'INV-2026-00000002', 2, 2, 1, 'PAID', '2026-10-21 12:30:00', NULL, NULL),
  (3, 'INV-2026-00000003', 3, 3, NULL, 'PAID', '2026-10-22 15:45:00', NULL, NULL),
  (4, 'INV-2026-00000004', 4, 2, NULL, 'DRAFT', '2026-10-26 09:20:00', NULL, NULL),
  (5, 'INV-2026-00000005', 5, 3, NULL, 'DRAFT', '2026-10-23 16:00:00', NULL, NULL);

INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_rate) VALUES
  (1, 1, 2, 120.00, 5.00), (1, 4, 1, 210.00, 12.00),
  (2, 2, 2, 145.00, 5.00), (2, 5, 1, 155.00, 5.00),
  (3, 3, 1, 265.00, 5.00), (3, 13, 1, 320.00, 28.00),
  (4, 6, 2, 110.00, 12.00),
  (5, 10, 1, 135.00, 18.00), (5, 14, 1, 125.00, 12.00);

INSERT INTO loyalty_transactions (customer_id, invoice_id, points, reason, created_at)
VALUES (5, 5, 2, 'Original invoice points before void', '2026-10-23 16:00:00');
UPDATE invoices
SET status = 'VOID', void_reason = 'Duplicate billing entry', voided_by = 1
WHERE invoice_id = 5;

INSERT INTO payments (invoice_id, method_id, amount, paid_at, reference_no) VALUES
  (1, 1,  486.20, '2026-10-20 10:20:00', 'CASH-20261020-01'),
  (2, 2,  443.89, '2026-10-21 12:35:00', 'UPI-20261021-02'),
  (3, 3,  687.85, '2026-10-22 15:50:00', 'CARD-20261022-03'),
  (4, 4,   50.00, '2026-10-26 09:25:00', 'WALLET-PARTIAL-04'),
  (1, 2,    1.00, '2026-10-20 10:21:00', 'UPI-SPLIT-20261020-01');

INSERT INTO loyalty_transactions (customer_id, invoice_id, points, reason, created_at) VALUES
  (1, 1, 4, 'Invoice paid', '2026-10-20 10:20:00'),
  (2, 2, 4, 'Invoice paid', '2026-10-21 12:35:00'),
  (3, 3, 6, 'Invoice paid', '2026-10-22 15:50:00'),
  (1, 1, 1, 'Bonus points', '2026-10-20 10:22:00');

INSERT INTO whatsapp_messages (invoice_id, to_number, status, provider_message_id, error, attempts, created_at) VALUES
  (1, '+919876543210', 'SENT', 'demo-msg-001', NULL, 1, '2026-10-20 10:21:00'),
  (2, '+919876543211', 'DELIVERED', 'demo-msg-002', NULL, 1, '2026-10-21 12:36:00'),
  (3, '+919876543212', 'FAILED', NULL, 'Provider timeout in seeded example', 3, '2026-10-22 15:51:00'),
  (4, '+919876543213', 'QUEUED', NULL, NULL, 0, '2026-10-26 09:25:00'),
  (5, '+919876543214', 'SENT', 'demo-msg-005', NULL, 1, '2026-10-23 16:06:00');

INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by, changed_at) VALUES
  ('products', 1, 'PRICE_UPDATE', JSON_OBJECT('price', 115.00), JSON_OBJECT('price', 120.00), 1, '2026-10-20 08:00:00'),
  ('stock', 1, 'QUANTITY_UPDATE', JSON_OBJECT('quantity', 35), JSON_OBJECT('quantity', 40), 1, '2026-10-20 08:05:00'),
  ('products', 4, 'PRICE_UPDATE', JSON_OBJECT('price', 200.00), JSON_OBJECT('price', 210.00), 1, '2026-10-20 08:10:00'),
  ('stock', 7, 'QUANTITY_UPDATE', JSON_OBJECT('quantity', 30), JSON_OBJECT('quantity', 38), 1, '2026-10-20 08:15:00'),
  ('invoices', 5, 'VOID', JSON_OBJECT('status', 'PAID'), JSON_OBJECT('status', 'VOID'), 1, '2026-10-23 16:05:00');
