-- Row Level Security (RLS) Policies Migration
-- This migration enables RLS on all tables and creates security policies
-- to replace Firestore security rules

-- ============================================================================
-- 1. Enable RLS on All Tables
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Create Helper Functions
-- ============================================================================

-- Note: Supabase provides auth.uid() natively, but we create helper functions
-- for account membership checks and role verification

-- Function to check if user is system owner
CREATE OR REPLACE FUNCTION is_system_owner() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to check if user is account member
CREATE OR REPLACE FUNCTION is_account_member(account_id_param uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_members
    WHERE account_id = account_id_param AND user_id = auth.uid()
  ) OR is_system_owner();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to get user's role in account
CREATE OR REPLACE FUNCTION get_user_role_in_account(account_id_param uuid) RETURNS text AS $$
  SELECT role FROM account_members
  WHERE account_id = account_id_param AND user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to check if user is account admin
CREATE OR REPLACE FUNCTION is_account_admin(account_id_param uuid) RETURNS boolean AS $$
  SELECT is_system_owner() OR (
    is_account_member(account_id_param) AND
    get_user_role_in_account(account_id_param) = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. Create RLS Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users Table Policies
-- ----------------------------------------------------------------------------

-- Users can read if authenticated
CREATE POLICY "Users can read if authenticated"
  ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can create their own document
CREATE POLICY "Users can create their own document"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own document, or owners can update any
CREATE POLICY "Users can update own or owners can update any"
  ON users FOR UPDATE
  USING (auth.uid() = id OR is_system_owner())
  WITH CHECK (auth.uid() = id OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Accounts Table Policies
-- ----------------------------------------------------------------------------
-- Account admins can:
--   - Read accounts they're members of
--   - Update accounts they're admins of (name, etc.)
--   - Manage members (via account_members table)
-- Account admins CANNOT:
--   - Create new accounts (only system owners can)
--   - Delete accounts (only system owners can)

-- Account members can read accounts
CREATE POLICY "Account members can read accounts"
  ON accounts FOR SELECT
  USING (is_account_member(id) OR is_system_owner());

-- Only owners can create accounts
CREATE POLICY "Only owners can create accounts"
  ON accounts FOR INSERT
  WITH CHECK (is_system_owner());

-- Account admins can update their own accounts (but not create or delete)
CREATE POLICY "Account admins can update their accounts"
  ON accounts FOR UPDATE
  USING (is_account_admin(id) OR is_system_owner())
  WITH CHECK (is_account_admin(id) OR is_system_owner());

-- Only system owners can delete accounts
CREATE POLICY "Only owners can delete accounts"
  ON accounts FOR DELETE
  USING (is_system_owner());

-- ----------------------------------------------------------------------------
-- Account Members Table Policies
-- ----------------------------------------------------------------------------
-- Account admins can manage members for their accounts:
--   - Create new users/members for their account
--   - Update member roles
--   - Remove members from their account

-- Account members can read members
CREATE POLICY "Account members can read members"
  ON account_members FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account admins can insert members
CREATE POLICY "Account admins can insert members"
  ON account_members FOR INSERT
  WITH CHECK (is_account_admin(account_id) OR is_system_owner());

-- Account admins can update members
CREATE POLICY "Account admins can update members"
  ON account_members FOR UPDATE
  USING (is_account_admin(account_id) OR is_system_owner())
  WITH CHECK (is_account_admin(account_id) OR is_system_owner());

-- Account admins can delete members
CREATE POLICY "Account admins can delete members"
  ON account_members FOR DELETE
  USING (is_account_admin(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Projects Table Policies
-- ----------------------------------------------------------------------------

-- Account members can read projects
CREATE POLICY "Account members can read projects"
  ON projects FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can create projects
CREATE POLICY "Account members can create projects"
  ON projects FOR INSERT
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- Account members can update projects
CREATE POLICY "Account members can update projects"
  ON projects FOR UPDATE
  USING (is_account_member(account_id) OR is_system_owner())
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- Account members can delete projects
CREATE POLICY "Account members can delete projects"
  ON projects FOR DELETE
  USING (is_account_member(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Items Table Policies
-- ----------------------------------------------------------------------------

-- Account members can read items
CREATE POLICY "Account members can read items"
  ON items FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can create items
CREATE POLICY "Account members can create items"
  ON items FOR INSERT
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- Account members can update items
CREATE POLICY "Account members can update items"
  ON items FOR UPDATE
  USING (is_account_member(account_id) OR is_system_owner())
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- Account members can delete items
CREATE POLICY "Account members can delete items"
  ON items FOR DELETE
  USING (is_account_member(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Transactions Table Policies
-- ----------------------------------------------------------------------------

-- Account members can read transactions
CREATE POLICY "Account members can read transactions"
  ON transactions FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can create transactions
CREATE POLICY "Account members can create transactions"
  ON transactions FOR INSERT
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- Account members can update transactions
CREATE POLICY "Account members can update transactions"
  ON transactions FOR UPDATE
  USING (is_account_member(account_id) OR is_system_owner())
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- Account members can delete transactions
CREATE POLICY "Account members can delete transactions"
  ON transactions FOR DELETE
  USING (is_account_member(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Business Profiles Table Policies
-- ----------------------------------------------------------------------------

-- Account members can read business profiles
CREATE POLICY "Account members can read business profiles"
  ON business_profiles FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account admins can insert business profiles
CREATE POLICY "Account admins can insert business profiles"
  ON business_profiles FOR INSERT
  WITH CHECK (is_account_admin(account_id) OR is_system_owner());

-- Account admins can update business profiles
CREATE POLICY "Account admins can update business profiles"
  ON business_profiles FOR UPDATE
  USING (is_account_admin(account_id) OR is_system_owner())
  WITH CHECK (is_account_admin(account_id) OR is_system_owner());

-- Account admins can delete business profiles
CREATE POLICY "Account admins can delete business profiles"
  ON business_profiles FOR DELETE
  USING (is_account_admin(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Tax Presets Table Policies
-- ----------------------------------------------------------------------------

-- Account members can read tax presets
CREATE POLICY "Account members can read tax presets"
  ON tax_presets FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account admins can insert tax presets
CREATE POLICY "Account admins can insert tax presets"
  ON tax_presets FOR INSERT
  WITH CHECK (is_account_admin(account_id) OR is_system_owner());

-- Account admins can update tax presets
CREATE POLICY "Account admins can update tax presets"
  ON tax_presets FOR UPDATE
  USING (is_account_admin(account_id) OR is_system_owner())
  WITH CHECK (is_account_admin(account_id) OR is_system_owner());

-- Account admins can delete tax presets
CREATE POLICY "Account admins can delete tax presets"
  ON tax_presets FOR DELETE
  USING (is_account_admin(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Audit Logs Table Policies
-- ----------------------------------------------------------------------------

-- Account members can read audit logs
CREATE POLICY "Account members can read audit logs"
  ON audit_logs FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can create audit logs
CREATE POLICY "Account members can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Transaction Audit Logs Table Policies
-- ----------------------------------------------------------------------------

-- Account members can read transaction audit logs
CREATE POLICY "Account members can read transaction audit logs"
  ON transaction_audit_logs FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can create transaction audit logs
CREATE POLICY "Account members can create transaction audit logs"
  ON transaction_audit_logs FOR INSERT
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- ----------------------------------------------------------------------------
-- Invitations Table Policies
-- ----------------------------------------------------------------------------

-- Authenticated users can read invitations
CREATE POLICY "Authenticated users can read invitations"
  ON invitations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Account admins can create invitations
CREATE POLICY "Account admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    (account_id IS NULL AND is_system_owner()) OR
    (account_id IS NOT NULL AND (is_account_admin(account_id) OR is_system_owner()))
  );

-- Authenticated users can update invitations
CREATE POLICY "Authenticated users can update invitations"
  ON invitations FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Account admins can delete invitations
CREATE POLICY "Account admins can delete invitations"
  ON invitations FOR DELETE
  USING (
    (account_id IS NULL AND is_system_owner()) OR
    (account_id IS NOT NULL AND (is_account_admin(account_id) OR is_system_owner()))
  );

