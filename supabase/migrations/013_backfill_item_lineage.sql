-- Backfill script for item lineage data
-- This populates origin_transaction_id, latest_transaction_id, and creates initial lineage edges

-- Step 1: Backfill latest_transaction_id from existing transaction_id
UPDATE public.items
SET latest_transaction_id = transaction_id
WHERE transaction_id IS NOT NULL
  AND latest_transaction_id IS NULL;

-- Step 2: Backfill origin_transaction_id from earliest known transaction
-- For items with a transaction_id, use that as origin (simplified approach)
-- In a more sophisticated backfill, you could query audit_logs or transaction history
UPDATE public.items
SET origin_transaction_id = transaction_id
WHERE transaction_id IS NOT NULL
  AND origin_transaction_id IS NULL;

-- Step 3: Create initial lineage edges from previous_project_transaction_id where available
-- This captures known transitions from the previous project linkage system
INSERT INTO public.item_lineage_edges (
  account_id,
  item_id,
  from_transaction_id,
  to_transaction_id,
  created_at,
  note
)
SELECT DISTINCT
  i.account_id,
  i.item_id,
  i.previous_project_transaction_id,
  i.transaction_id,
  COALESCE(i.last_updated, i.created_at, NOW()),
  'Migrated from previous_project_transaction_id'
FROM public.items i
WHERE i.previous_project_transaction_id IS NOT NULL
  AND i.transaction_id IS NOT NULL
  AND i.previous_project_transaction_id != i.transaction_id
  AND NOT EXISTS (
    -- Avoid duplicates: check if edge already exists
    SELECT 1 FROM public.item_lineage_edges e
    WHERE e.account_id = i.account_id
      AND e.item_id = i.item_id
      AND e.from_transaction_id = i.previous_project_transaction_id
      AND e.to_transaction_id = i.transaction_id
  );

-- Step 4: Create edges for items that moved to inventory (previous_project_transaction_id exists but transaction_id is null)
INSERT INTO public.item_lineage_edges (
  account_id,
  item_id,
  from_transaction_id,
  to_transaction_id,
  created_at,
  note
)
SELECT DISTINCT
  i.account_id,
  i.item_id,
  i.previous_project_transaction_id,
  NULL, -- null = to inventory
  COALESCE(i.last_updated, i.created_at, NOW()),
  'Migrated from previous_project_transaction_id (moved to inventory)'
FROM public.items i
WHERE i.previous_project_transaction_id IS NOT NULL
  AND i.transaction_id IS NULL
  AND NOT EXISTS (
    -- Avoid duplicates
    SELECT 1 FROM public.item_lineage_edges e
    WHERE e.account_id = i.account_id
      AND e.item_id = i.item_id
      AND e.from_transaction_id = i.previous_project_transaction_id
      AND e.to_transaction_id IS NULL
  );

-- Note: This backfill is conservative and only creates edges where we have clear evidence
-- of transitions (previous_project_transaction_id). Items without previous linkage will
-- get edges created as they move going forward.

