# Task 3.2: Account Service Migration

## Objective
Migrate the account service from Firestore to Supabase Postgres, converting all Firestore queries to SQL queries.

## Steps

### 1. Update `src/services/accountService.ts`

Replace Firestore imports and update all functions:

```typescript
import { supabase } from './supabase'
import { convertTimestamps } from './databaseService'
import { Account, AccountMembership } from '@/types'

/**
 * Account Service - Manages account creation, membership, and role management
 */
export const accountService = {
  /**
   * Create a new account (owners only)
   */
  async createAccount(name: string, createdBy: string): Promise<string> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        name,
        created_by: createdBy,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  },

  /**
   * Get account details
   */
  async getAccount(accountId: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    const accountData = convertTimestamps(data)
    return {
      id: accountData.id,
      name: accountData.name,
      createdAt: accountData.created_at,
      createdBy: accountData.created_by
    } as Account
  },

  /**
   * Get account for a user (from user's accountId field)
   */
  async getUserAccount(userId: string): Promise<Account | null> {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('id', userId)
      .single()

    if (userError || !userData?.account_id) {
      return null
    }

    return await this.getAccount(userData.account_id)
  },

  /**
   * Get user's role in a specific account
   */
  async getUserRoleInAccount(userId: string, accountId: string): Promise<'admin' | 'user' | null> {
    const { data, error } = await supabase
      .from('account_members')
      .select('role')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data.role as 'admin' | 'user'
  },

  /**
   * Add user to account with a role
   */
  async addUserToAccount(
    userId: string,
    accountId: string,
    role: 'admin' | 'user'
  ): Promise<void> {
    const { error } = await supabase
      .from('account_members')
      .insert({
        account_id: accountId,
        user_id: userId,
        role,
        joined_at: new Date().toISOString()
      })

    if (error) throw error
  },

  /**
   * Update user's role in account (owner or account admin only)
   */
  async updateUserRoleInAccount(
    userId: string,
    accountId: string,
    role: 'admin' | 'user'
  ): Promise<void> {
    const { error } = await supabase
      .from('account_members')
      .update({
        role,
        joined_at: new Date().toISOString() // Update timestamp on role change
      })
      .eq('account_id', accountId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Remove user from account
   */
  async removeUserFromAccount(userId: string, accountId: string): Promise<void> {
    const { error } = await supabase
      .from('account_members')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Get all members of an account
   */
  async getAccountMembers(accountId: string): Promise<AccountMembership[]> {
    const { data, error } = await supabase
      .from('account_members')
      .select('*')
      .eq('account_id', accountId)

    if (error) throw error

    return (data || []).map(member => convertTimestamps({
      userId: member.user_id,
      accountId: member.account_id,
      role: member.role,
      joinedAt: member.joined_at
    })) as AccountMembership[]
  },

  /**
   * Check if user is member of account
   */
  async isAccountMember(userId: string, accountId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('account_members')
      .select('user_id')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return false
      }
      throw error
    }

    return !!data
  },

  /**
   * Get all accounts (owners only)
   */
  async getAllAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(account => convertTimestamps({
      id: account.id,
      name: account.name,
      createdAt: account.created_at,
      createdBy: account.created_by
    })) as Account[]
  }
}
```

## Key Changes

1. **Collection references**: `collection(db, 'accounts')` → `supabase.from('accounts')`
2. **Document references**: `doc(db, 'accounts', id)` → `.eq('id', id)`
3. **Subcollections**: `collection(db, 'accounts', accountId, 'members')` → `supabase.from('account_members').eq('account_id', accountId)`
4. **Queries**: Firestore query builder → Supabase query builder
5. **Timestamps**: `serverTimestamp()` → `new Date().toISOString()`
6. **Field names**: Convert camelCase to snake_case (e.g., `accountId` → `account_id`)

## Verification
- [ ] All account service functions migrated
- [ ] Can create accounts
- [ ] Can get accounts
- [ ] Can manage account memberships
- [ ] Can update user roles
- [ ] All queries work correctly

## Next Steps
- Proceed to Task 3.3: Inventory Service Migration

