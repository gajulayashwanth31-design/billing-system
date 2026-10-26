USE billing_db;

CREATE OR REPLACE VIEW v_invoice_items_calc AS
SELECT
  ii.item_id,
  ii.invoice_id,
  ii.product_id,
  p.name AS product_name,
  ii.quantity,
  ii.unit_price,
  ii.tax_rate,
  ROUND(ii.quantity * ii.unit_price, 2) AS line_subtotal,
  ROUND(ii.quantity * ii.unit_price * ii.tax_rate / 100, 2) AS line_tax,
  ROUND(ii.quantity * ii.unit_price * (1 + ii.tax_rate / 100), 2) AS line_total
FROM invoice_items ii
JOIN products p ON p.product_id = ii.product_id;

CREATE OR REPLACE VIEW v_invoice_totals AS
SELECT
  totals.invoice_id,
  totals.subtotal,
  totals.tax,
  totals.discount_amount,
  ROUND(totals.subtotal + totals.tax - totals.discount_amount, 2) AS grand_total,
  totals.paid_amount,
  ROUND(GREATEST(totals.subtotal + totals.tax - totals.discount_amount - totals.paid_amount, 0), 2) AS balance
FROM (
  SELECT
    i.invoice_id,
    ROUND(COALESCE(SUM(calc.line_subtotal), 0), 2) AS subtotal,
    ROUND(COALESCE(SUM(calc.line_tax), 0), 2) AS tax,
    ROUND(CASE
      WHEN d.discount_id IS NULL OR d.is_active = FALSE OR NOW() NOT BETWEEN d.valid_from AND d.valid_to
        OR COALESCE(SUM(calc.line_subtotal + calc.line_tax), 0) < d.min_bill_amount THEN 0
      WHEN d.type = 'PERCENT' THEN LEAST(
        COALESCE(SUM(calc.line_subtotal + calc.line_tax), 0),
        COALESCE(SUM(calc.line_subtotal + calc.line_tax), 0) * d.value / 100
      )
      ELSE LEAST(COALESCE(SUM(calc.line_subtotal + calc.line_tax), 0), d.value)
    END, 2) AS discount_amount,
    ROUND(COALESCE((
      SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.invoice_id
    ), 0), 2) AS paid_amount
  FROM invoices i
  LEFT JOIN v_invoice_items_calc calc ON calc.invoice_id = i.invoice_id
  LEFT JOIN discounts d ON d.discount_id = i.discount_id
  GROUP BY i.invoice_id, d.discount_id, d.is_active, d.valid_from, d.valid_to,
           d.min_bill_amount, d.type, d.value
) totals;

CREATE OR REPLACE VIEW v_customer_tier AS
SELECT
  c.customer_id,
  c.name,
  COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN totals.grand_total ELSE 0 END), 0) AS lifetime_spend,
  CASE
    WHEN COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN totals.grand_total ELSE 0 END), 0) < 10000 THEN 'Silver'
    WHEN COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN totals.grand_total ELSE 0 END), 0) <= 50000 THEN 'Gold'
    ELSE 'Platinum'
  END AS tier
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.customer_id
LEFT JOIN v_invoice_totals totals ON totals.invoice_id = i.invoice_id
GROUP BY c.customer_id, c.name;

CREATE OR REPLACE VIEW v_daily_sales AS
SELECT DATE(i.created_at) AS sale_date, COUNT(*) AS invoice_count,
       ROUND(SUM(t.grand_total), 2) AS sales_total
FROM invoices i
JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
WHERE i.status = 'PAID'
GROUP BY DATE(i.created_at);

CREATE OR REPLACE VIEW v_sales_by_category AS
SELECT c.category_id, c.name AS category_name,
       ROUND(SUM(calc.line_subtotal + calc.line_tax), 2) AS sales_total,
       SUM(calc.quantity) AS units_sold
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.invoice_id
JOIN v_invoice_items_calc calc ON calc.item_id = ii.item_id
JOIN products p ON p.product_id = ii.product_id
JOIN categories c ON c.category_id = p.category_id
WHERE i.status = 'PAID'
GROUP BY c.category_id, c.name;

CREATE OR REPLACE VIEW v_top_products AS
SELECT p.product_id, p.sku, p.name,
       SUM(calc.quantity) AS units_sold,
       ROUND(SUM(calc.line_total), 2) AS sales_total
FROM invoices i
JOIN invoice_items ii ON ii.invoice_id = i.invoice_id
JOIN v_invoice_items_calc calc ON calc.item_id = ii.item_id
JOIN products p ON p.product_id = ii.product_id
WHERE i.status = 'PAID'
GROUP BY p.product_id, p.sku, p.name;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT p.product_id, p.sku, p.name, p.reorder_level, s.quantity
FROM products p
JOIN stock s ON s.product_id = p.product_id
WHERE s.quantity <= p.reorder_level AND p.is_active = TRUE;

DROP PROCEDURE IF EXISTS sp_create_invoice;
DROP PROCEDURE IF EXISTS sp_void_invoice;
DROP PROCEDURE IF EXISTS sp_monthly_sales_report;

DELIMITER $$
CREATE PROCEDURE sp_create_invoice(
  IN p_customer_id BIGINT UNSIGNED,
  IN p_cashier_id BIGINT UNSIGNED,
  IN p_discount_code VARCHAR(40),
  IN p_items JSON,
  OUT p_invoice_id BIGINT UNSIGNED
)
BEGIN
  DECLARE item_count INT DEFAULT 0;
  DECLARE item_index INT DEFAULT 0;
  DECLARE current_product_id BIGINT UNSIGNED;
  DECLARE current_quantity INT UNSIGNED;
  DECLARE current_price DECIMAL(12,2);
  DECLARE current_tax DECIMAL(5,2);
  DECLARE current_discount_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE current_invoice_no VARCHAR(30);
  DECLARE discount_count INT DEFAULT 0;
  DECLARE product_count INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET p_invoice_id = NULL;
  IF p_items IS NULL OR JSON_TYPE(p_items) <> 'ARRAY' OR JSON_LENGTH(p_items) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice must contain at least one item';
  END IF;
  START TRANSACTION;

  IF p_discount_code IS NOT NULL AND TRIM(p_discount_code) <> '' THEN
    SELECT COUNT(*) INTO discount_count
    FROM discounts
    WHERE code = p_discount_code AND is_active = TRUE
      AND NOW() BETWEEN valid_from AND valid_to;
    IF discount_count = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Discount code is invalid or expired';
    END IF;
    SELECT discount_id INTO current_discount_id
    FROM discounts
    WHERE code = p_discount_code AND is_active = TRUE
      AND NOW() BETWEEN valid_from AND valid_to;
  END IF;

  SET current_invoice_no = CONCAT('P-', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 20));
  INSERT INTO invoices (invoice_no, customer_id, cashier_id, discount_id, status)
  VALUES (current_invoice_no, p_customer_id, p_cashier_id, current_discount_id, 'DRAFT');
  SET p_invoice_id = LAST_INSERT_ID();
  UPDATE invoices
  SET invoice_no = CONCAT('INV-', YEAR(CURRENT_DATE), '-', LPAD(p_invoice_id, 8, '0'))
  WHERE invoice_id = p_invoice_id;

  SET item_count = JSON_LENGTH(p_items);
  WHILE item_index < item_count DO
    SET current_product_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', item_index, '].product_id'))) AS UNSIGNED);
    SET current_quantity = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', item_index, '].quantity'))) AS UNSIGNED);
    IF current_product_id IS NULL OR current_quantity IS NULL OR current_quantity = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Each invoice item requires a valid product_id and positive quantity';
    END IF;
    SELECT COUNT(*) INTO product_count
    FROM products
    WHERE product_id = current_product_id AND is_active = TRUE;
    IF product_count = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Product does not exist or is inactive';
    END IF;
    SELECT p.price, tr.rate_percent INTO current_price, current_tax
    FROM products p JOIN tax_rates tr ON tr.tax_id = p.tax_id
    WHERE p.product_id = current_product_id AND p.is_active = TRUE
    FOR UPDATE;
    INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_rate)
    VALUES (p_invoice_id, current_product_id, current_quantity, current_price, current_tax);
    SET item_index = item_index + 1;
  END WHILE;

  IF current_discount_id IS NOT NULL AND (
    SELECT subtotal + tax FROM v_invoice_totals WHERE invoice_id = p_invoice_id
  ) < (SELECT min_bill_amount FROM discounts WHERE discount_id = current_discount_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice does not meet the discount minimum amount';
  END IF;
  COMMIT;
END$$

CREATE PROCEDURE sp_void_invoice(
  IN p_invoice_id BIGINT UNSIGNED,
  IN p_reason VARCHAR(500),
  IN p_user_id BIGINT UNSIGNED
)
BEGIN
  DECLARE current_status VARCHAR(20);
  DECLARE invoice_count INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET @app_user_id = NULL;
    ROLLBACK;
    RESIGNAL;
  END;
  IF p_reason IS NULL OR CHAR_LENGTH(TRIM(p_reason)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A void reason is required';
  END IF;
  START TRANSACTION;
  SELECT COUNT(*) INTO invoice_count FROM invoices WHERE invoice_id = p_invoice_id;
  IF invoice_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice does not exist';
  END IF;
  SELECT status INTO current_status FROM invoices WHERE invoice_id = p_invoice_id FOR UPDATE;
  IF current_status = 'VOID' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice is already void';
  END IF;
  SET @app_user_id = p_user_id;
  UPDATE invoices SET status = 'VOID', void_reason = p_reason, voided_by = p_user_id
  WHERE invoice_id = p_invoice_id;
  SET @app_user_id = NULL;
  COMMIT;
END$$

CREATE PROCEDURE sp_monthly_sales_report(IN p_year INT, IN p_month INT)
BEGIN
  IF p_month < 1 OR p_month > 12 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Month must be between 1 and 12';
  END IF;
  SELECT DATE(i.created_at) AS sale_date, COUNT(*) AS invoice_count,
         ROUND(SUM(t.grand_total), 2) AS sales_total
  FROM invoices i
  JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
  WHERE i.status = 'PAID' AND YEAR(i.created_at) = p_year AND MONTH(i.created_at) = p_month
  GROUP BY DATE(i.created_at)
  ORDER BY sale_date;
END$$
DELIMITER ;
