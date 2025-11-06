-- Fix Accounts Table RLS Policies
-- Account admins should NOT be able to create or delete accounts
-- They can only update accounts they're admins of
-- Only system owners can create/delete accounts

-- Drop existing policies
DROP POLICY IF EXISTS "Account admins can update accounts" ON accounts;
DROP POLICY IF EXISTS "Account admins can delete accounts" ON accounts;

-- Account admins can update their own accounts (but not create or delete)
CREATE POLICY "Account admins can update their accounts"
  ON accounts FOR UPDATE
  USING (is_account_admin(id) OR is_system_owner())
  WITH CHECK (is_account_admin(id) OR is_system_owner());

-- Only system owners can delete accounts
CREATE POLICY "Only owners can delete accounts"
  ON accounts FOR DELETE
  USING (is_system_owner());

