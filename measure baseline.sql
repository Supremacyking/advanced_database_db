EXPLAIN ANALYZE
  SELECT SUM(quantity * unit_price) AS total_sales
  FROM retail
  WHERE invoice_date BETWEEN '2010-12-01' AND '2010-12-31';
