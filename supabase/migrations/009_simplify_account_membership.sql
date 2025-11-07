-- Migration to simplify account membership model
-- Remove account_members table and use user.account_id directly
-- System owners (user.role = 'owner') can access all accounts
-- Regular users belong to one account via account_id
-- First user in an account gets role='admin', others get role='user'

-- ============================================================================
-- PRE-MIGRATION: Storage Policies Setup
-- ============================================================================
-- We need to handle storage policies that depend on is_account_admin() function
-- Steps 1-3: Drop old policies, create temporary function, recreate policies

-- Step 1: Drop storage policies that depend on is_account_admin
DROP POLICY IF EXISTS "Account admins can upload business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can update business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can delete business logos" ON storage.objects;

-- Step 2: Create temporary helper function for storage policies
-- This function works with the OLD system (account_members) before migration
-- It will be replaced by can_access_account after migration completes
CREATE OR REPLACE FUNCTION is_account_admin(account_id_param uuid) RETURNS boolean AS $$
  SELECT is_system_owner() OR (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_id = account_id_param 
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Step 3: Recreate storage policies using temporary function
-- These will be updated again after migration to use can_access_account
CREATE POLICY "Account admins can upload business logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
);

CREATE POLICY "Account admins can update business logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
)
WITH CHECK (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
);

CREATE POLICY "Account admins can delete business logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
);

-- ============================================================================
-- MAIN MIGRATION: Simplify Account Membership
-- ============================================================================

-- Step 1: Update users table role constraint to allow 'admin' and 'user'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'user', 'designer', 'viewer') OR role IS NULL);

-- Step 2: Add account_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Step 3: Migrate data from account_members to users.account_id
-- For each user, set their account_id to their first account_members entry
UPDATE users u
SET account_id = (
  SELECT account_id 
  FROM account_members am 
  WHERE am.user_id = u.id 
  ORDER BY am.joined_at ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM account_members am WHERE am.user_id = u.id
);

-- Step 4: Set roles based on first user in account
-- First user in each account gets 'admin', others get 'user'
-- (System owners keep 'owner' role)
UPDATE users u
SET role = CASE
  WHEN u.role = 'owner' THEN 'owner' -- Keep system owners
  WHEN u.account_id IS NULL THEN NULL -- No account, no role
  WHEN u.id = (
    SELECT user_id 
    FROM account_members am 
    WHERE am.account_id = u.account_id 
    ORDER BY am.joined_at ASC 
    LIMIT 1
  ) THEN 'admin' -- First user in account
  ELSE 'user' -- Other users in account
END
WHERE u.account_id IS NOT NULL AND u.role != 'owner';

-- Step 5: Create index for account_id lookups
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);

-- Step 6: Create RLS helper functions to use account_id instead of account_members

-- Function to check if user is system owner
CREATE OR REPLACE FUNCTION is_system_owner() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to check if user belongs to an account (or is owner)
CREATE OR REPLACE FUNCTION is_account_member(account_id_param uuid) RETURNS boolean AS $$
  SELECT is_system_owner() OR (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND account_id = account_id_param
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to check if user can access account (owner or matching account_id)
CREATE OR REPLACE FUNCTION can_access_account(account_id_param uuid) RETURNS boolean AS $$
  SELECT is_system_owner() OR (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND account_id = account_id_param
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Remove old functions that referenced account_members
-- Note: We keep is_account_admin temporarily for storage policies, will drop it later
DROP FUNCTION IF EXISTS get_user_role_in_account(uuid);

-- Step 7: Update RLS policies to use new functions

-- Accounts policies
DROP POLICY IF EXISTS "Account members can read accounts" ON accounts;
CREATE POLICY "Users can read their account or owners can read all"
  ON accounts FOR SELECT
  USING (can_access_account(id) OR is_system_owner());

DROP POLICY IF EXISTS "Account admins can update their accounts" ON accounts;
CREATE POLICY "Users can update their account or owners can update any"
  ON accounts FOR UPDATE
  USING (can_access_account(id) OR is_system_owner())
  WITH CHECK (can_access_account(id) OR is_system_owner());

-- Projects policies
DROP POLICY IF EXISTS "Account members can read projects" ON projects;
CREATE POLICY "Users can read projects in their account or owners can read all"
  ON projects FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can create projects" ON projects;
CREATE POLICY "Users can create projects in their account or owners can create any"
  ON projects FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can update projects" ON projects;
CREATE POLICY "Users can update projects in their account or owners can update any"
  ON projects FOR UPDATE
  USING (can_access_account(account_id) OR is_system_owner())
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can delete projects" ON projects;
CREATE POLICY "Users can delete projects in their account or owners can delete any"
  ON projects FOR DELETE
  USING (can_access_account(account_id) OR is_system_owner());

-- Items policies
DROP POLICY IF EXISTS "Account members can read items" ON items;
CREATE POLICY "Users can read items in their account or owners can read all"
  ON items FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can create items" ON items;
CREATE POLICY "Users can create items in their account or owners can create any"
  ON items FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can update items" ON items;
CREATE POLICY "Users can update items in their account or owners can update any"
  ON items FOR UPDATE
  USING (can_access_account(account_id) OR is_system_owner())
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can delete items" ON items;
CREATE POLICY "Users can delete items in their account or owners can delete any"
  ON items FOR DELETE
  USING (can_access_account(account_id) OR is_system_owner());

-- Transactions policies
DROP POLICY IF EXISTS "Account members can read transactions" ON transactions;
CREATE POLICY "Users can read transactions in their account or owners can read all"
  ON transactions FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can create transactions" ON transactions;
CREATE POLICY "Users can create transactions in their account or owners can create any"
  ON transactions FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can update transactions" ON transactions;
CREATE POLICY "Users can update transactions in their account or owners can update any"
  ON transactions FOR UPDATE
  USING (can_access_account(account_id) OR is_system_owner())
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can delete transactions" ON transactions;
CREATE POLICY "Users can delete transactions in their account or owners can delete any"
  ON transactions FOR DELETE
  USING (can_access_account(account_id) OR is_system_owner());

-- Business profiles policies
DROP POLICY IF EXISTS "Account members can read business profiles" ON business_profiles;
CREATE POLICY "Users can read business profiles in their account or owners can read all"
  ON business_profiles FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account admins can insert business profiles" ON business_profiles;
CREATE POLICY "Users can create business profiles in their account or owners can create any"
  ON business_profiles FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account admins can update business profiles" ON business_profiles;
CREATE POLICY "Users can update business profiles in their account or owners can update any"
  ON business_profiles FOR UPDATE
  USING (can_access_account(account_id) OR is_system_owner())
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account admins can delete business profiles" ON business_profiles;
CREATE POLICY "Users can delete business profiles in their account or owners can delete any"
  ON business_profiles FOR DELETE
  USING (can_access_account(account_id) OR is_system_owner());

-- Tax presets policies
DROP POLICY IF EXISTS "Account members can read tax presets" ON tax_presets;
CREATE POLICY "Users can read tax presets in their account or owners can read all"
  ON tax_presets FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account admins can insert tax presets" ON tax_presets;
CREATE POLICY "Users can create tax presets in their account or owners can create any"
  ON tax_presets FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account admins can update tax presets" ON tax_presets;
CREATE POLICY "Users can update tax presets in their account or owners can update any"
  ON tax_presets FOR UPDATE
  USING (can_access_account(account_id) OR is_system_owner())
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account admins can delete tax presets" ON tax_presets;
CREATE POLICY "Users can delete tax presets in their account or owners can delete any"
  ON tax_presets FOR DELETE
  USING (can_access_account(account_id) OR is_system_owner());

-- Audit logs policies
DROP POLICY IF EXISTS "Account members can read audit logs" ON audit_logs;
CREATE POLICY "Users can read audit logs in their account or owners can read all"
  ON audit_logs FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can create audit logs" ON audit_logs;
CREATE POLICY "Users can create audit logs in their account or owners can create any"
  ON audit_logs FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

-- Transaction audit logs policies
DROP POLICY IF EXISTS "Account members can read transaction audit logs" ON transaction_audit_logs;
CREATE POLICY "Users can read transaction audit logs in their account or owners can read all"
  ON transaction_audit_logs FOR SELECT
  USING (can_access_account(account_id) OR is_system_owner());

DROP POLICY IF EXISTS "Account members can create transaction audit logs" ON transaction_audit_logs;
CREATE POLICY "Users can create transaction audit logs in their account or owners can create any"
  ON transaction_audit_logs FOR INSERT
  WITH CHECK (can_access_account(account_id) OR is_system_owner());

-- Invitations policies
DROP POLICY IF EXISTS "Account admins can create invitations" ON invitations;
CREATE POLICY "Users can create invitations for their account or owners can create any"
  ON invitations FOR INSERT
  WITH CHECK (
    (account_id IS NULL AND is_system_owner()) OR
    (account_id IS NOT NULL AND (can_access_account(account_id) OR is_system_owner()))
  );

DROP POLICY IF EXISTS "Account admins can delete invitations" ON invitations;
CREATE POLICY "Users can delete invitations for their account or owners can delete any"
  ON invitations FOR DELETE
  USING (
    (account_id IS NULL AND is_system_owner()) OR
    (account_id IS NOT NULL AND (can_access_account(account_id) OR is_system_owner()))
  );

-- Note: account_members table policies will be removed when we drop the table
-- We'll drop the account_members table in the next migration after verifying everything works

-- ============================================================================
-- POST-MIGRATION: Update Storage Policies to Use New Function
-- ============================================================================
-- Step 5: Update storage policies to use can_access_account instead of is_account_admin

-- Drop old storage policies
DROP POLICY IF EXISTS "Account admins can upload business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can update business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can delete business logos" ON storage.objects;

-- Recreate with new function (can_access_account)
CREATE POLICY "Account admins can upload business logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  can_access_account(extract_account_id_from_path(name))
);

CREATE POLICY "Account admins can update business logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  can_access_account(extract_account_id_from_path(name))
)
WITH CHECK (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  can_access_account(extract_account_id_from_path(name))
);

CREATE POLICY "Account admins can delete business logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  can_access_account(extract_account_id_from_path(name))
);

-- Keep the temporary is_account_admin function for now because some
-- existing policies on `account_members` still depend on it. 
-- IMPORTANT: This function MUST be dropped in migration 010 after we drop
-- the account_members table and its policies.

