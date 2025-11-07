# Simplifying Account Membership and Role System

## Overview

We're simplifying how account membership and roles work in the application. This migration removes the complexity of the `account_members` table and moves to a simpler model where users directly belong to accounts.

## The Problem We're Solving

### Current System (Complex)
- Users belong to accounts via the `account_members` table (many-to-many relationship)
- Account-level roles stored in `account_members` table (`admin` or `user`)
- System-level roles stored in `users` table (`owner`)
- Requires joining tables to check membership
- Confusing: two different role systems (system-level vs account-level)

### New System (Simple)
- Users belong to **one account** via `user.account_id` (one-to-one relationship)
- Roles stored directly in `users.role`:
  - `'owner'` - System owner (can access all accounts) - WOUDL BE GREAT IF THEY CAN ACCESS ALL ACCOUNTS
  - `'admin'` - Account admin (first user in an account)
  - `'user'` - Regular account user (other users in account)
- No more `account_members` table
- Single source of truth for roles

## What Changes

### Database Changes
1. **Add `account_id` column** to `users` table
2. **Migrate data** from `account_members` to `users.account_id`
3. **Set roles** based on first user in account:
   - First user in account → `role = 'admin'`
   - Other users → `role = 'user'`
   - System owners → `role = 'owner'` (unchanged)
4. **Update all RLS policies** to use `user.account_id` instead of `account_members`
5. **Drop `account_members` table** (in separate migration after verification)

### Code Changes
- `AccountContext` now uses `user.account_id` directly
- `accountService` simplified - no more account member management
- Permission checks use `user.role` directly
- `isAdmin` = system owner OR account admin (`role = 'admin'`)

## Migration Steps

### Prerequisites
- All existing migrations (001-008) must be applied
- Users should have entries in `account_members` table (for data migration)

### Step 1: Drop Storage Policies That Depend on Old Function

The storage policies for business logos depend on `is_account_admin()` function. We need to drop them first:

```sql
-- Drop storage policies that depend on is_account_admin
DROP POLICY IF EXISTS "Account admins can upload business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can update business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can delete business logos" ON storage.objects;
```

### Step 2: Create Temporary Helper Function

Create a temporary `is_account_admin` function that will work with the new system. This is needed to recreate the storage policies:

```sql
-- Temporary function for storage policies (will be replaced by migration)
CREATE OR REPLACE FUNCTION is_account_admin(account_id_param uuid) RETURNS boolean AS $$
  SELECT is_system_owner() OR (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND account_id = account_id_param 
      AND role IN ('owner', 'admin')
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Note:** This function checks if user is system owner OR has `role = 'admin'` for the given account. This will be replaced by `can_access_account` after migration.

### Step 3: Recreate Storage Policies Temporarily

Recreate the storage policies using the temporary function:

```sql
-- Recreate business logo storage policies using temporary function
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
```

### Step 4: Run Migration 009

Now run the full migration `009_simplify_account_membership.sql`. This migration will:

1. **Update role constraint** to allow `'admin'` and `'user'` roles
2. **Add `account_id` column** to users table
3. **Migrate data** from `account_members` to `users.account_id`
4. **Set roles**:
   - First user in each account → `'admin'`
   - Other users → `'user'`
   - System owners → `'owner'` (unchanged)
5. **Create helper functions**:
   - `is_system_owner()` - checks if user is system owner
   - `is_account_member(account_id)` - checks if user belongs to account
   - `can_access_account(account_id)` - checks if user can access account
6. **Drop old functions**:
   - `get_user_role_in_account()`
   - `is_account_admin()` (old version)
7. **Update all RLS policies** to use new functions

### Step 5: Update Storage Policies to Use New Function

After migration completes, update storage policies to use `can_access_account`:

```sql
-- Drop old storage policies
DROP POLICY IF EXISTS "Account admins can upload business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can update business logos" ON storage.objects;
DROP POLICY IF EXISTS "Account admins can delete business logos" ON storage.objects;

-- Recreate with new function
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
```

## Verification Checklist

After completing all steps, verify the following:

### 1. Database Schema
```sql
-- Check account_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'account_id';
-- Should show: account_id | uuid | YES
```

### 2. Data Migration
```sql
-- Check users have account_id populated
SELECT id, email, role, account_id 
FROM users 
ORDER BY created_at;
-- All users should have account_id set (except possibly system owners)
```

### 3. Role Assignment
```sql
-- Verify roles are set correctly
SELECT 
  account_id,
  COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
  COUNT(*) FILTER (WHERE role = 'user') as user_count,
  COUNT(*) FILTER (WHERE role = 'owner') as owner_count
FROM users
WHERE account_id IS NOT NULL
GROUP BY account_id;
-- Each account should have exactly 1 admin (first user)
```

### 4. Functions Exist
```sql
-- Check new functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_system_owner', 'is_account_member', 'can_access_account');
-- Should return all three functions
```

### 5. RLS Policies Updated
```sql
-- Check policies use new functions
SELECT schemaname, tablename, policyname, definition
FROM pg_policies 
WHERE definition LIKE '%can_access_account%'
LIMIT 10;
-- Should show policies using can_access_account
```

### 6. Storage Policies Updated
```sql
-- Check storage policies exist
SELECT policyname, definition
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%business logos%';
-- Should show 3 policies using can_access_account
```

### 7. Application Functionality
- [ ] Users can log in
- [ ] Account loads correctly (check AccountContext)
- [ ] Admin users can see User Management
- [ ] Admin users can manage Tax Presets
- [ ] Admin users can manage Business Profile
- [ ] Regular users can add transactions
- [ ] Business logo uploads work
- [ ] All account data loads (projects, items, transactions)

## What Happens Next

After verifying everything works:

1. **Migration 010** will:
   - Drop RLS policies on `account_members` table
   - Drop the `account_members` table (no longer needed)
   - Drop the temporary `is_account_admin(uuid)` function (kept in migration 009 because `account_members` policies depended on it)
2. **Code cleanup** - remove any remaining references to `account_members` or `AccountMembership` type

## Rollback Plan

If something goes wrong, you can rollback by:

1. Restoring the `account_members` table from backup
2. Reverting code changes (git)
3. Re-running old migrations

However, **this migration is designed to be safe** - it doesn't delete the `account_members` table, so data is preserved until migration 010.

## Key Benefits

1. **Simpler data model** - one column instead of a join table
2. **Clearer roles** - single role field instead of two role systems
3. **Better performance** - no joins needed to check membership
4. **Easier to understand** - users belong to one account, period
5. **System owners** can still access all accounts (special case)

## Important Notes

- **System owners** (`role = 'owner'`) can access ALL accounts (bypass account_id check)
- **Account admins** (`role = 'admin'`) can manage their account settings
- **Regular users** (`role = 'user'`) can use the account but not manage settings
- **First user in account** automatically gets `admin` role
- Users can only belong to **one account** (no multi-account support)
