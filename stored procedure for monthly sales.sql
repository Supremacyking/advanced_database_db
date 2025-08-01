CREATE OR REPLACE FUNCTION get_monthly_sales(year_input INT, month_input INT)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM retail
    WHERE EXTRACT(YEAR FROM invoice_date) = year_input
      AND EXTRACT(MONTH FROM invoice_date) = month_input
  );
END;
$$ LANGUAGE plpgsql;

SELECT get_monthly_sales(2010, 12);
SELECT month_input AS month,
       get_monthly_sales(2020, month_input) AS total_sales
FROM generate_series(1, 12) AS month_input;

