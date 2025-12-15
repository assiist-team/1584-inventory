-- Create budget_categories table for account-scoped budget categories
-- This table stores budget categories per account, allowing each account
-- to manage its own set of categories independently.
-- Verify prerequisite RLS helper function exists. Fail early with a clear message if it does not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'can_access_account'
  ) THEN
    RAISE EXCEPTION 'Prerequisite migration missing: required RLS helper function can_access_account(uuid) not found. Run earlier RLS migrations (e.g. 009/002) before running 017_create_budget_categories.sql';
  END IF;
END
$$;

-- Create is_account_admin function if it doesn't exist (it was dropped in migration 010)
-- This function checks if the current user is an admin of the given account
CREATE OR REPLACE FUNCTION is_account_admin(account_id_param uuid) RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND account_id = account_id_param 
    AND role = 'admin'
  ) OR public.is_system_owner();
$$;

CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure slug is unique per account
  UNIQUE (account_id, slug)
);

CREATE INDEX idx_budget_categories_account_id ON budget_categories(account_id);
CREATE INDEX idx_budget_categories_slug ON budget_categories(account_id, slug);
CREATE INDEX idx_budget_categories_is_archived ON budget_categories(account_id, is_archived) WHERE is_archived = FALSE;

-- Enable RLS
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only account members can read categories, account admins can manage them
CREATE POLICY "Users can read budget categories in their account or owners can read all"
  ON budget_categories FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

CREATE POLICY "Account admins can create budget categories in their account or owners can create any"
  ON budget_categories FOR INSERT
  WITH CHECK (is_account_admin(account_id));

CREATE POLICY "Account admins can update budget categories in their account or owners can update any"
  ON budget_categories FOR UPDATE
  USING (is_account_admin(account_id))
  WITH CHECK (is_account_admin(account_id));

CREATE POLICY "Account admins can delete budget categories in their account or owners can delete any"
  ON budget_categories FOR DELETE
  USING (is_account_admin(account_id));

-- Add comments
COMMENT ON TABLE budget_categories IS 'Stores account-scoped budget categories for transactions';
COMMENT ON COLUMN budget_categories.account_id IS 'Foreign key to accounts table, scopes categories per account';
COMMENT ON COLUMN budget_categories.name IS 'Display name of the budget category';
COMMENT ON COLUMN budget_categories.slug IS 'URL-friendly identifier, unique per account';
COMMENT ON COLUMN budget_categories.is_archived IS 'When true, category is hidden from normal selectors but preserved for historical integrity';
COMMENT ON COLUMN budget_categories.metadata IS 'Optional JSONB for additional category metadata';

