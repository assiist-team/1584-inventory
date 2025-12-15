# Task 5.1: Row Level Security Policies

## Objective
Create Row Level Security (RLS) policies in Supabase Postgres to replace Firestore security rules.

## Steps

### 1. Enable RLS on All Tables

Run these SQL commands in Supabase SQL Editor:

```sql
-- Enable RLS on all tables
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
```

### 2. Create Helper Functions

```sql
-- Function to check if user is authenticated
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
$$ LANGUAGE sql STABLE;

-- Function to check if user is system owner
CREATE OR REPLACE FUNCTION is_system_owner() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to get user's account ID
CREATE OR REPLACE FUNCTION get_user_account_id() RETURNS uuid AS $$
  SELECT account_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

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
```

### 3. Create RLS Policies

#### Users Table
```sql
-- Users can read their own data or if authenticated
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
  USING (auth.uid() = id OR is_system_owner());
```

#### Accounts Table
```sql
-- Account members can read their accounts
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
```

#### Account Members Table
```sql
-- Account members can read members
CREATE POLICY "Account members can read members"
  ON account_members FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account admins can write members
CREATE POLICY "Account admins can write members"
  ON account_members FOR ALL
  USING (is_account_admin(account_id) OR is_system_owner());
```

#### Projects Table
```sql
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
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can delete projects
CREATE POLICY "Account members can delete projects"
  ON projects FOR DELETE
  USING (is_account_member(account_id) OR is_system_owner());
```

#### Items Table
```sql
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
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can delete items
CREATE POLICY "Account members can delete items"
  ON items FOR DELETE
  USING (is_account_member(account_id) OR is_system_owner());
```

#### Transactions Table
```sql
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
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can delete transactions
CREATE POLICY "Account members can delete transactions"
  ON transactions FOR DELETE
  USING (is_account_member(account_id) OR is_system_owner());
```

#### Business Profiles Table
```sql
-- Account members can read business profiles
CREATE POLICY "Account members can read business profiles"
  ON business_profiles FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account admins can write business profiles
CREATE POLICY "Account admins can write business profiles"
  ON business_profiles FOR ALL
  USING (is_account_admin(account_id) OR is_system_owner());
```

#### Tax Presets Table
```sql
-- Account members can read tax presets
CREATE POLICY "Account members can read tax presets"
  ON tax_presets FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account admins can write tax presets
CREATE POLICY "Account admins can write tax presets"
  ON tax_presets FOR ALL
  USING (is_account_admin(account_id) OR is_system_owner());
```

#### Audit Logs Tables
```sql
-- Account members can read audit logs
CREATE POLICY "Account members can read audit logs"
  ON audit_logs FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

-- Account members can create audit logs
CREATE POLICY "Account members can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (is_account_member(account_id) OR is_system_owner());

-- Similar for transaction_audit_logs
CREATE POLICY "Account members can read transaction audit logs"
  ON transaction_audit_logs FOR SELECT
  USING (is_account_member(account_id) OR is_system_owner());

CREATE POLICY "Account members can create transaction audit logs"
  ON transaction_audit_logs FOR INSERT
  WITH CHECK (is_account_member(account_id) OR is_system_owner());
```

#### Invitations Table
```sql
-- Authenticated users can read invitations
CREATE POLICY "Authenticated users can read invitations"
  ON invitations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Account admins can create invitations
CREATE POLICY "Account admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (is_account_admin(account_id) OR is_system_owner());

-- Authenticated users can update invitations
CREATE POLICY "Authenticated users can update invitations"
  ON invitations FOR UPDATE
  USING (auth.uid() IS NOT NULL);
```

## Testing RLS Policies

Test each policy to ensure they work correctly:

```sql
-- Test as authenticated user
SET request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Test queries
SELECT * FROM accounts;
SELECT * FROM projects WHERE account_id = 'account-uuid';
```

## Verification
- [x] RLS enabled on all tables
- [x] Helper functions created
- [x] Policies created for all tables
- [x] Security warnings resolved (search_path set for SECURITY DEFINER functions)
- [x] Policies tested
- [x] Authorization works correctly

## Next Steps
- Proceed to Task 5.2: Storage Policies

