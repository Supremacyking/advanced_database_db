CREATE OR REPLACE FUNCTION enforce_positive_values()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative';
  END IF;

  IF NEW.unit_price < 0 THEN
    RAISE EXCEPTION 'Unit price cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_enforce_positive_values
BEFORE INSERT OR UPDATE ON retail
FOR EACH ROW
EXECUTE FUNCTION enforce_positive_values();
