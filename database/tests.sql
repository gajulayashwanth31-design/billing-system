USE billing_db;

DELIMITER $$
CREATE PROCEDURE run_phase1_tests()
BEGIN
  DECLARE initial_stock INT UNSIGNED;
  DECLARE resulting_stock INT UNSIGNED;
  DECLARE test_invoice_id BIGINT UNSIGNED;
  DECLARE test_error BOOLEAN DEFAULT FALSE;
  DECLARE point_count INT DEFAULT 0;
  DECLARE initial_invoice_count BIGINT DEFAULT 0;
  DECLARE initial_audit_id BIGINT UNSIGNED DEFAULT 0;

  START TRANSACTION;
  SELECT quantity INTO initial_stock FROM stock WHERE product_id = 15;
  INSERT INTO invoices (invoice_no, customer_id, cashier_id, status)
  VALUES (CONCAT('T', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 20)), 1, 2, 'DRAFT');
  SET test_invoice_id = LAST_INSERT_ID();
  INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_rate)
  VALUES (test_invoice_id, 15, 2, 175.00, 28.00);
  SELECT quantity INTO resulting_stock FROM stock WHERE product_id = 15;
  SELECT IF(resulting_stock = initial_stock - 2, 'PASS: stock reduced after item insert',
            'FAIL: stock was not reduced after item insert') AS result;
  ROLLBACK;

  START TRANSACTION;
  SET test_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET test_error = TRUE;
    INSERT INTO invoices (invoice_no, customer_id, cashier_id, status)
    VALUES (CONCAT('T', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 20)), 1, 2, 'DRAFT');
    SET test_invoice_id = LAST_INSERT_ID();
    INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_rate)
    VALUES (test_invoice_id, 15, 999999, 175.00, 28.00);
  END;
  SELECT IF(test_error, 'PASS: insufficient stock blocked',
            'FAIL: insufficient stock was not blocked') AS result;
  ROLLBACK;

  START TRANSACTION;
  SELECT COALESCE(MAX(log_id), 0) INTO initial_audit_id FROM audit_log;
  SET @app_user_id = 1;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET test_error = TRUE;
    UPDATE products SET price = price + 1 WHERE product_id = 1;
  END;
  SELECT IF(EXISTS (
    SELECT 1 FROM audit_log
    WHERE table_name = 'products' AND record_id = 1 AND action = 'PRICE_UPDATE'
      AND log_id > initial_audit_id
  ), 'PASS: price change audited', 'FAIL: price change audit missing') AS result;
  SET @app_user_id = NULL;
  ROLLBACK;

  START TRANSACTION;
  SELECT COALESCE(MAX(log_id), 0) INTO initial_audit_id FROM audit_log;
  SET @app_user_id = 1;
  UPDATE stock SET quantity = quantity + 1 WHERE product_id = 1;
  SELECT IF(EXISTS (
    SELECT 1 FROM audit_log
    WHERE table_name = 'stock' AND record_id = 1 AND action = 'QUANTITY_UPDATE'
      AND log_id > initial_audit_id
  ), 'PASS: manual stock change audited', 'FAIL: manual stock change audit missing') AS result;
  SET @app_user_id = NULL;
  ROLLBACK;

  SET test_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET test_error = TRUE;
    UPDATE invoices SET status = 'DRAFT' WHERE invoice_id = 1;
  END;
  SELECT IF(test_error, 'PASS: paid invoice update blocked',
            'FAIL: paid invoice update was not blocked') AS result;

  SET test_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET test_error = TRUE;
    DELETE FROM invoices WHERE invoice_id = 1;
  END;
  SELECT IF(test_error, 'PASS: invoice hard delete blocked',
            'FAIL: invoice hard delete was not blocked') AS result;

  START TRANSACTION;
  INSERT INTO invoices (invoice_no, customer_id, cashier_id, status)
  VALUES (CONCAT('T', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 20)), 1, 2, 'DRAFT');
  SET test_invoice_id = LAST_INSERT_ID();
  INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_rate)
  VALUES (test_invoice_id, 15, 1, 175.00, 28.00);
  SELECT grand_total INTO @test_grand_total
  FROM v_invoice_totals WHERE invoice_id = test_invoice_id;
  INSERT INTO payments (invoice_id, method_id, amount)
  VALUES (test_invoice_id, 1, @test_grand_total);
  SELECT COUNT(*) INTO point_count
  FROM loyalty_transactions
  WHERE invoice_id = test_invoice_id AND reason = 'Invoice paid';
  SELECT IF((SELECT status FROM invoices WHERE invoice_id = test_invoice_id) = 'PAID'
            AND point_count = 1, 'PASS: payment marks invoice PAID and awards points',
            'FAIL: payment did not mark invoice PAID and award points') AS result;
  ROLLBACK;

  START TRANSACTION;
  SELECT quantity INTO initial_stock FROM stock WHERE product_id = 15;
  INSERT INTO invoices (invoice_no, customer_id, cashier_id, status)
  VALUES (CONCAT('T', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 20)), 1, 2, 'DRAFT');
  SET test_invoice_id = LAST_INSERT_ID();
  INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_rate)
  VALUES (test_invoice_id, 15, 1, 175.00, 28.00);
  SELECT grand_total INTO @test_grand_total
  FROM v_invoice_totals WHERE invoice_id = test_invoice_id;
  INSERT INTO payments (invoice_id, method_id, amount)
  VALUES (test_invoice_id, 1, @test_grand_total);
  UPDATE invoices SET status = 'VOID', void_reason = 'Trigger test', voided_by = 1
  WHERE invoice_id = test_invoice_id;
  SELECT quantity INTO resulting_stock FROM stock WHERE product_id = 15;
  SELECT COUNT(*) INTO point_count
  FROM loyalty_transactions
  WHERE invoice_id = test_invoice_id AND points < 0;
  SELECT IF(resulting_stock = initial_stock AND point_count = 1,
            'PASS: void restores stock and reverses points',
            'FAIL: void did not restore stock and reverse points') AS result;
  ROLLBACK;

  SELECT COUNT(*) INTO initial_invoice_count FROM invoices;
  SELECT quantity INTO initial_stock FROM stock WHERE product_id = 15;
  SET test_error = FALSE;
  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET test_error = TRUE;
    CALL sp_create_invoice(
      1, 2, NULL,
      JSON_ARRAY(
        JSON_OBJECT('product_id', 15, 'quantity', 1),
        JSON_OBJECT('product_id', 15, 'quantity', 999999)
      ),
      @failed_invoice_id
    );
  END;
  SELECT quantity INTO resulting_stock FROM stock WHERE product_id = 15;
  SELECT IF(test_error
            AND initial_stock = resulting_stock
            AND initial_invoice_count = (SELECT COUNT(*) FROM invoices),
            'PASS: failed invoice procedure rolls back fully',
            'FAIL: failed invoice procedure left partial changes') AS result;
END$$
DELIMITER ;

CALL run_phase1_tests();
DROP PROCEDURE run_phase1_tests;
