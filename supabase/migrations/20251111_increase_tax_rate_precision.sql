-- Increase precision of tax_rate_pct to allow percentage values >= 10.0000
BEGIN;

ALTER TABLE transactions
  ALTER COLUMN tax_rate_pct TYPE DECIMAL(6,4)
    USING tax_rate_pct::numeric;

ALTER TABLE items
  ALTER COLUMN tax_rate_pct TYPE DECIMAL(6,4)
    USING tax_rate_pct::numeric;

COMMIT;



