-- Update script (fixed): Ensure business inventory items have project_price satisfying
-- purchase_price <= project_price < market_value
-- Targets: items in account '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94' that are business inventory (project_id IS NULL) and source = 'Homegoods'

DO $$
DECLARE
  updated_count int := 0;
BEGIN
  WITH candidates AS (
    SELECT id,
           item_id,
           NULLIF(purchase_price,'')::numeric AS purchase_n,
           NULLIF(project_price,'')::numeric AS project_n,
           NULLIF(market_value,'')::numeric AS market_n
    FROM items
    WHERE account_id = '1dd4fd75-8eea-4f7a-98e7-bf45b987ae94'
      AND project_id IS NULL
      AND source = 'Homegoods'
  ), computed AS (
    SELECT id,
      -- Determine a safe project_price that satisfies purchase_n <= project < market_n
      CASE
        WHEN purchase_n IS NULL AND project_n IS NULL AND market_n IS NULL THEN NULL
        WHEN project_n IS NULL AND purchase_n IS NOT NULL AND market_n IS NOT NULL AND purchase_n < market_n THEN purchase_n
        WHEN project_n IS NULL AND purchase_n IS NOT NULL AND market_n IS NULL THEN purchase_n
        WHEN project_n IS NULL AND purchase_n IS NULL AND market_n IS NOT NULL THEN (market_n - 0.01)
        WHEN project_n IS NULL THEN purchase_n
        WHEN project_n < purchase_n THEN purchase_n
        WHEN market_n IS NOT NULL AND project_n >= market_n THEN (market_n - 0.01)
        ELSE project_n
      END AS new_project_price
    FROM candidates
  )
  UPDATE items i
  SET project_price = to_char(c.new_project_price, 'FM9999990.00'),
      market_value = to_char(
        GREATEST(
          COALESCE(NULLIF(i.market_value,'')::numeric, 0),
          round(c.new_project_price * 1.30, 2)
        )
      , 'FM9999990.00'),
      last_updated = now()
  FROM computed c
  WHERE i.id = c.id
    AND c.new_project_price IS NOT NULL
    -- Only update when project_price differs or market_value is less than required
    AND (
      i.project_price IS NULL
      OR NULLIF(i.project_price,'')::numeric IS DISTINCT FROM c.new_project_price
      OR COALESCE(NULLIF(i.market_value,'')::numeric, 0) < round(c.new_project_price * 1.30, 2)
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % business inventory items project_price', updated_count;
END;
$$ LANGUAGE plpgsql;

-- Notes:
-- - If market_value is NULL and purchase_price exists, set project_price = purchase_price.
-- - If purchase_price >= market_value, set project_price = market_value - 0.01 to preserve ordering.
-- - Numeric casts are used because the DB stores prices as text.
-- - Run this after you have cleaned/created test data.


