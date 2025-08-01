
CREATE OR REPLACE FUNCTION update_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE retail
    SET quantity = quantity - NEW.quantity
    WHERE stockcode = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_update_stock
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_stock();
