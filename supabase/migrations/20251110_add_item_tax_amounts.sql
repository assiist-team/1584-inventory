-- Add two item-level tax amount columns (stored as text to match existing price/text scheme)
ALTER TABLE items
  ADD COLUMN tax_amount_purchase_price TEXT,
  ADD COLUMN tax_amount_project_price TEXT;

-- Indexes are not necessary for these derived fields by default.


