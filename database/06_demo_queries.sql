USE billing_db;

-- 1. Invoice, customer, cashier, and payment summary.
SELECT i.invoice_no, c.name AS customer, u.username AS cashier, i.status,
       totals.grand_total, totals.paid_amount, totals.balance
FROM invoices i
JOIN customers c ON c.customer_id = i.customer_id
JOIN users u ON u.user_id = i.cashier_id
JOIN v_invoice_totals totals ON totals.invoice_id = i.invoice_id
ORDER BY i.created_at DESC;

-- 2. Paid sales by customer.
SELECT c.customer_id, c.name, ROUND(SUM(t.grand_total), 2) AS lifetime_spend
FROM customers c
JOIN invoices i ON i.customer_id = c.customer_id
JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
WHERE i.status = 'PAID'
GROUP BY c.customer_id, c.name
ORDER BY lifetime_spend DESC;

-- 3. Customers with more than one invoice.
SELECT c.name, COUNT(i.invoice_id) AS invoice_count
FROM customers c
JOIN invoices i ON i.customer_id = c.customer_id
GROUP BY c.customer_id, c.name
HAVING COUNT(i.invoice_id) > 1;

-- 4. Products priced above the catalog average.
SELECT sku, name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC;

-- 5. Rank customers by paid spend using a window function.
SELECT customer_id, name, lifetime_spend,
       RANK() OVER (ORDER BY lifetime_spend DESC) AS spend_rank
FROM v_customer_tier;

-- 6. Current stock compared with reorder levels.
SELECT sku, name, quantity, reorder_level
FROM v_low_stock
ORDER BY quantity, name;

-- 7. Itemized invoice calculations from the computed view.
SELECT i.invoice_no, calc.product_name, calc.quantity, calc.line_subtotal,
       calc.line_tax, calc.line_total
FROM v_invoice_items_calc calc
JOIN invoices i ON i.invoice_id = calc.invoice_id
ORDER BY i.invoice_no, calc.item_id;

-- 8. Paid sales grouped by product category.
SELECT category_name, units_sold, sales_total
FROM v_sales_by_category
ORDER BY sales_total DESC;

-- 9. Top-selling products.
SELECT sku, name, units_sold, sales_total
FROM v_top_products
ORDER BY units_sold DESC, sales_total DESC
LIMIT 5;

-- 10. Customers whose paid spend is above the average paid-customer spend.
SELECT tier.customer_id, tier.name, tier.lifetime_spend
FROM v_customer_tier tier
WHERE tier.lifetime_spend > (
  SELECT AVG(customer_spend)
  FROM (
    SELECT SUM(t.grand_total) AS customer_spend
    FROM invoices i
    JOIN v_invoice_totals t ON t.invoice_id = i.invoice_id
    WHERE i.status = 'PAID'
    GROUP BY i.customer_id
  ) spend_by_customer
)
ORDER BY tier.lifetime_spend DESC;
