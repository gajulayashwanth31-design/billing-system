USE billing_db;

SET @has_tier_discount_column = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'tier_discount_percent'
);
SET @tier_column_sql = IF(
  @has_tier_discount_column = 0,
  'ALTER TABLE invoices ADD COLUMN tier_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE tier_column_stmt FROM @tier_column_sql;
EXECUTE tier_column_stmt;
DEALLOCATE PREPARE tier_column_stmt;

SET @has_tier_discount_constraint = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND CONSTRAINT_NAME = 'chk_invoices_tier_discount'
);
SET @tier_constraint_sql = IF(
  @has_tier_discount_constraint = 0,
  'ALTER TABLE invoices ADD CONSTRAINT chk_invoices_tier_discount CHECK (tier_discount_percent BETWEEN 0 AND 8)',
  'SELECT 1'
);
PREPARE tier_constraint_stmt FROM @tier_constraint_sql;
EXECUTE tier_constraint_stmt;
DEALLOCATE PREPARE tier_constraint_stmt;
