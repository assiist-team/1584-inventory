-- Backfill tax amount fields for existing items.
-- Computes tax_amount_purchase_price and tax_amount_project_price using tax_rate_pct where available.
BEGIN;

-- Safely treat empty strings as zero and use COALESCE for missing tax_rate_pct.
UPDATE items
SET
  tax_amount_purchase_price = to_char(
    ROUND(
      (COALESCE(NULLIF(purchase_price, ''), '0')::numeric) * COALESCE(tax_rate_pct, 0) / 100.0
    , 4)
  , 'FM999999999990.0000'),
  tax_amount_project_price = to_char(
    ROUND(
      (COALESCE(NULLIF(project_price, ''), '0')::numeric) * COALESCE(tax_rate_pct, 0) / 100.0
    , 4)
  , 'FM999999999990.0000');

COMMIT;


