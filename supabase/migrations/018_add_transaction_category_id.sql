-- Add category_id foreign key column to transactions table
-- This column references budget_categories and allows transactions to be
-- associated with account-scoped budget categories.
-- The column is nullable to allow gradual migration without breaking existing data.

-- Verify prerequisite tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_categories'
  ) THEN
    RAISE EXCEPTION 'Prerequisite migration missing: budget_categories table not found. Run 017_create_budget_categories.sql before running 018_add_transaction_category_id.sql';
  END IF;
END
$$;

-- Add category_id column as nullable foreign key
ALTER TABLE transactions
  ADD COLUMN category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL;

-- Create index for efficient lookups and joins
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_account_category ON transactions(account_id, category_id);

-- Add comment
COMMENT ON COLUMN transactions.category_id IS 'Foreign key to budget_categories table. Nullable to allow gradual migration from legacy budget_category text field.';

