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
   * Get account for a user (from account_members table)
   */
  async getUserAccount(userId: string): Promise<Account | null> {
    const { data: membershipData, error: membershipError } = await supabase
      .from('account_members')
      .select('account_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membershipData?.account_id) {
      return null
    }

    return await this.getAccount(membershipData.account_id)
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

    return (data || []).map(member => {
      const converted = convertTimestamps(member)
      return {
        userId: converted.user_id,
        accountId: converted.account_id,
        role: converted.role,
        joinedAt: converted.joined_at
      } as AccountMembership
    })
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

    return (data || []).map(account => {
      const converted = convertTimestamps(account)
      return {
        id: converted.id,
        name: converted.name,
        createdAt: converted.created_at,
        createdBy: converted.created_by
      } as Account
    })
  }
}

