USE billing_db;

-- Reject invoice items that cannot be fulfilled from current stock.
DELIMITER $$
CREATE TRIGGER trg_invoice_items_stock_check
BEFORE INSERT ON invoice_items
FOR EACH ROW
BEGIN
  DECLARE available_quantity INT UNSIGNED DEFAULT 0;
  SELECT COALESCE((SELECT quantity FROM stock WHERE product_id = NEW.product_id), 0)
    INTO available_quantity;
  IF available_quantity < NEW.quantity THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock for requested product quantity';
  END IF;
END$$

-- Deduct stock as invoice items are added.
CREATE TRIGGER trg_invoice_items_stock_deduct
AFTER INSERT ON invoice_items
FOR EACH ROW
BEGIN
  UPDATE stock
  SET quantity = quantity - NEW.quantity
  WHERE product_id = NEW.product_id;
END$$

-- Audit products created through an actor-scoped admin transaction.
CREATE TRIGGER trg_products_insert_audit
AFTER INSERT ON products
FOR EACH ROW
BEGIN
  IF @app_user_id IS NOT NULL THEN
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES (
      'products', NEW.product_id, 'CREATE', NULL,
      JSON_OBJECT(
        'sku', NEW.sku, 'name', NEW.name, 'category_id', NEW.category_id,
        'tax_id', NEW.tax_id, 'price', NEW.price, 'reorder_level', NEW.reorder_level
      ),
      @app_user_id
    );
  END IF;
END$$

-- Audit product price changes.
CREATE TRIGGER trg_products_price_audit
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  IF NOT (OLD.price <=> NEW.price) THEN
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES (
      'products', NEW.product_id, 'PRICE_UPDATE',
      JSON_OBJECT('price', OLD.price), JSON_OBJECT('price', NEW.price),
      @app_user_id
    );
  END IF;
END$$

-- Audit stock quantity adjustments.
CREATE TRIGGER trg_stock_adjustment_audit
AFTER UPDATE ON stock
FOR EACH ROW
BEGIN
  IF NOT (OLD.quantity <=> NEW.quantity) THEN
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES (
      'stock', NEW.product_id, 'QUANTITY_UPDATE',
      JSON_OBJECT('quantity', OLD.quantity), JSON_OBJECT('quantity', NEW.quantity),
      @app_user_id
    );
  END IF;
END$$

-- Keep finalized and paid invoices immutable except for an administrative void.
CREATE TRIGGER trg_invoices_immutable
BEFORE UPDATE ON invoices
FOR EACH ROW
BEGIN
  IF OLD.status IN ('FINALIZED', 'PAID')
     AND NOT (
       (NEW.status = 'VOID' AND OLD.status <> 'VOID')
       OR (
         OLD.status = 'FINALIZED' AND NEW.status = 'PAID'
         AND OLD.invoice_no <=> NEW.invoice_no
         AND OLD.customer_id <=> NEW.customer_id
         AND OLD.cashier_id <=> NEW.cashier_id
         AND OLD.discount_id <=> NEW.discount_id
         AND OLD.created_at <=> NEW.created_at
         AND OLD.void_reason <=> NEW.void_reason
         AND OLD.voided_by <=> NEW.voided_by
       )
     ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Finalized or paid invoices cannot be changed';
  END IF;
END$$

-- Prevent hard deletion of invoices.
CREATE TRIGGER trg_invoices_no_delete
BEFORE DELETE ON invoices
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoices cannot be deleted; void the invoice instead';
END$$

-- Mark fully paid invoices and award one loyalty point per 100 INR.
CREATE TRIGGER trg_payments_set_paid
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
  DECLARE invoice_total DECIMAL(12,2);
  DECLARE total_paid DECIMAL(12,2);
  DECLARE invoice_customer_id BIGINT UNSIGNED;
  SELECT grand_total INTO invoice_total
  FROM v_invoice_totals WHERE invoice_id = NEW.invoice_id;
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments WHERE invoice_id = NEW.invoice_id;
  IF total_paid >= invoice_total THEN
    SELECT customer_id INTO invoice_customer_id
    FROM invoices WHERE invoice_id = NEW.invoice_id;
    UPDATE invoices SET status = 'PAID'
    WHERE invoice_id = NEW.invoice_id AND status IN ('DRAFT', 'FINALIZED');
    IF ROW_COUNT() = 1 THEN
      INSERT INTO loyalty_transactions (customer_id, invoice_id, points, reason)
      VALUES (invoice_customer_id, NEW.invoice_id, FLOOR(invoice_total / 100), 'Invoice paid');
    END IF;
  END IF;
END$$

-- Restore sold stock and reverse earned loyalty points when an invoice is voided.
CREATE TRIGGER trg_invoices_void_restore
AFTER UPDATE ON invoices
FOR EACH ROW
BEGIN
  IF NEW.status = 'VOID' AND OLD.status <> 'VOID' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES (
      'invoices', NEW.invoice_id, 'VOID',
      JSON_OBJECT('status', OLD.status),
      JSON_OBJECT('status', NEW.status, 'reason', NEW.void_reason),
      @app_user_id
    );

    UPDATE stock s
    JOIN (
      SELECT product_id, SUM(quantity) AS quantity
      FROM invoice_items
      WHERE invoice_id = NEW.invoice_id
      GROUP BY product_id
    ) sold ON sold.product_id = s.product_id
    SET s.quantity = s.quantity + sold.quantity;

    INSERT INTO loyalty_transactions (customer_id, invoice_id, points, reason)
    SELECT NEW.customer_id, NEW.invoice_id, -SUM(points), 'Invoice voided: points reversed'
    FROM loyalty_transactions
    WHERE invoice_id = NEW.invoice_id AND points > 0
    HAVING SUM(points) > 0;
  END IF;
END$$
DELIMITER ;
