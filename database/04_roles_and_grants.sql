USE billing_db;

CREATE USER IF NOT EXISTS 'billing_customer'@'%' IDENTIFIED BY 'CHANGE_ME_CUSTOMER_PASSWORD';
CREATE USER IF NOT EXISTS 'billing_cashier'@'%' IDENTIFIED BY 'CHANGE_ME_CASHIER_PASSWORD';
CREATE USER IF NOT EXISTS 'billing_admin'@'%' IDENTIFIED BY 'CHANGE_ME_ADMIN_PASSWORD';

GRANT SELECT ON billing_db.customers TO 'billing_customer'@'%';
GRANT UPDATE (phone, address) ON billing_db.customers TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.invoices TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.invoice_items TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.v_invoice_items_calc TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.payments TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.payment_methods TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.loyalty_transactions TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.products TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.whatsapp_messages TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.v_invoice_totals TO 'billing_customer'@'%';
GRANT SELECT ON billing_db.v_customer_tier TO 'billing_customer'@'%';

GRANT SELECT ON billing_db.products TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.stock TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.categories TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.tax_rates TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.discounts TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.customers TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.invoices TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.invoice_items TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.payments TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.payment_methods TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.whatsapp_messages TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.v_invoice_items_calc TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.v_invoice_totals TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.v_customer_tier TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.v_daily_sales TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.v_sales_by_category TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.v_top_products TO 'billing_cashier'@'%';
GRANT SELECT ON billing_db.v_low_stock TO 'billing_cashier'@'%';
GRANT INSERT ON billing_db.customers TO 'billing_cashier'@'%';
GRANT UPDATE (name, phone, email, address, whatsapp_opt_in) ON billing_db.customers TO 'billing_cashier'@'%';
GRANT INSERT ON billing_db.payments TO 'billing_cashier'@'%';
GRANT INSERT ON billing_db.whatsapp_messages TO 'billing_cashier'@'%';
GRANT UPDATE ON billing_db.whatsapp_messages TO 'billing_cashier'@'%';
GRANT EXECUTE ON PROCEDURE billing_db.sp_create_invoice TO 'billing_cashier'@'%';
GRANT EXECUTE ON PROCEDURE billing_db.sp_record_payment TO 'billing_cashier'@'%';

GRANT ALL PRIVILEGES ON billing_db.* TO 'billing_admin'@'%';

-- Permission proof (run after connecting as billing_cashier).
-- DELETE FROM billing_db.products WHERE product_id = 1;
-- Expected: ERROR 1142 (42000): DELETE command denied to user 'billing_cashier'@'localhost' for table 'products'
-- UPDATE billing_db.products SET price = price + 1 WHERE product_id = 1;
-- Expected: ERROR 1142 (42000): UPDATE command denied to user 'billing_cashier'@'localhost' for table 'products'
-- MySQL substitutes the connecting host in the error text if it is not localhost.
