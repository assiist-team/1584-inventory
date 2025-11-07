-- Drop account_members table and related policies
-- This migration should be run after verifying that migration 009 works correctly

-- Drop RLS policies on account_members table
DROP POLICY IF EXISTS "Account members can read members" ON account_members;
DROP POLICY IF EXISTS "Account admins can insert members" ON account_members;
DROP POLICY IF EXISTS "Account admins can update members" ON account_members;
DROP POLICY IF EXISTS "Account admins can delete members" ON account_members;

-- Drop the account_members table
DROP TABLE IF EXISTS account_members;

-- Drop the temporary is_account_admin function that was kept in migration 009
-- This function was temporarily kept because account_members policies depended on it
-- Now that account_members is dropped, we can safely remove this function
DROP FUNCTION IF EXISTS is_account_admin(uuid);

