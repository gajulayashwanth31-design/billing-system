CREATE DATABASE IF NOT EXISTS billing_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE billing_db;

CREATE TABLE roles (
  role_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_users_failed_attempts CHECK (failed_attempts >= 0),
  INDEX idx_users_role_active (role_id, is_active)
) ENGINE=InnoDB;

CREATE TABLE customers (
  customer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(13) NOT NULL UNIQUE,
  email VARCHAR(254) NULL,
  address VARCHAR(500) NULL,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_customers_phone CHECK (phone REGEXP '^\\+91[6-9][0-9]{9}$'),
  INDEX idx_customers_name (name)
) ENGINE=InnoDB;

CREATE TABLE categories (
  category_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE tax_rates (
  tax_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  rate_percent DECIMAL(5,2) NOT NULL,
  CONSTRAINT chk_tax_rate CHECK (rate_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE products (
  product_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  tax_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  reorder_level INT UNSIGNED NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_products_tax FOREIGN KEY (tax_id) REFERENCES tax_rates(tax_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_products_price CHECK (price >= 0),
  INDEX idx_products_name_active (name, is_active),
  INDEX idx_products_category (category_id)
) ENGINE=InnoDB;

CREATE TABLE stock (
  product_id BIGINT UNSIGNED PRIMARY KEY,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_stock_quantity CHECK (quantity >= 0)
) ENGINE=InnoDB;

CREATE TABLE discounts (
  discount_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  type ENUM('PERCENT','FLAT') NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  valid_from DATETIME NOT NULL,
  valid_to DATETIME NOT NULL,
  min_bill_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_discount_value CHECK (value > 0),
  CONSTRAINT chk_discount_min_bill CHECK (min_bill_amount >= 0),
  CONSTRAINT chk_discount_dates CHECK (valid_to > valid_from)
) ENGINE=InnoDB;

CREATE TABLE payment_methods (
  method_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE invoices (
  invoice_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(30) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  cashier_id BIGINT UNSIGNED NOT NULL,
  discount_id BIGINT UNSIGNED NULL,
  status ENUM('DRAFT','FINALIZED','PAID','VOID') NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  void_reason VARCHAR(500) NULL,
  voided_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_cashier FOREIGN KEY (cashier_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_discount FOREIGN KEY (discount_id) REFERENCES discounts(discount_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_voided_by FOREIGN KEY (voided_by) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_invoices_customer_date (customer_id, created_at),
  INDEX idx_invoices_cashier_date (cashier_id, created_at),
  INDEX idx_invoices_status_date (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE invoice_items (
  item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL,
  CONSTRAINT fk_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_items_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_items_tax_rate CHECK (tax_rate BETWEEN 0 AND 100),
  INDEX idx_items_invoice (invoice_id),
  INDEX idx_items_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE payments (
  payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  method_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference_no VARCHAR(100) NULL,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payments_method FOREIGN KEY (method_id) REFERENCES payment_methods(method_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  INDEX idx_payments_invoice (invoice_id),
  INDEX idx_payments_paid_at (paid_at)
) ENGINE=InnoDB;

CREATE TABLE loyalty_transactions (
  txn_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  points INT NOT NULL,
  reason VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loyalty_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_loyalty_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_loyalty_customer_created (customer_id, created_at),
  INDEX idx_loyalty_invoice (invoice_id)
) ENGINE=InnoDB;

CREATE TABLE whatsapp_messages (
  msg_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  to_number VARCHAR(13) NOT NULL,
  status ENUM('QUEUED','SENT','DELIVERED','FAILED') NOT NULL DEFAULT 'QUEUED',
  provider_message_id VARCHAR(120) NULL,
  error TEXT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_whatsapp_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_whatsapp_attempts CHECK (attempts >= 0),
  INDEX idx_whatsapp_invoice_created (invoice_id, created_at),
  INDEX idx_whatsapp_status (status)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(64) NOT NULL,
  record_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(30) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  changed_by BIGINT UNSIGNED NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_audit_table_record (table_name, record_id),
  INDEX idx_audit_changed_at (changed_at),
  INDEX idx_audit_changed_by (changed_by)
) ENGINE=InnoDB;
