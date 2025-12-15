import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createMockAccount, createMockUser, createNotFoundError } from './test-utils'

// Mock Supabase before importing services
vi.mock('../supabase', async () => {
  const { createMockSupabaseClient } = await import('./test-utils')
  return {
    supabase: createMockSupabaseClient()
  }
})

// Mock databaseService
vi.mock('../databaseService', () => ({
  convertTimestamps: vi.fn((data) => data)
}))

// Import after mocks are set up
import { accountService } from '../accountService'
import * as supabaseModule from '../supabase'

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAccount', () => {
    it('should create a new account', async () => {
      const mockAccount = createMockAccount()
      const mockQueryBuilder = createMockSupabaseClient().from('accounts')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: mockAccount.id }, error: null })
      } as any)

      const accountId = await accountService.createAccount('Test Account', 'user-id')
      expect(accountId).toBe(mockAccount.id)
    })

    it('should throw error on failure', async () => {
      const error = { code: '23505', message: 'Duplicate key', details: null, hint: null }
      const mockQueryBuilder = createMockSupabaseClient().from('accounts')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error })
      } as any)

      await expect(
        accountService.createAccount('Test Account', 'user-id')
      ).rejects.toEqual(error)
    })
  })

  describe('getAccount', () => {
    it('should return account when found', async () => {
      const mockAccount = createMockAccount()
      const mockQueryBuilder = createMockSupabaseClient().from('accounts')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAccount, error: null })
      } as any)

      const account = await accountService.getAccount('test-account-id')
      expect(account).toBeTruthy()
      expect(account?.id).toBe(mockAccount.id)
      expect(account?.name).toBe(mockAccount.name)
    })

    it('should return null when account not found', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('accounts')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
      } as any)

      const account = await accountService.getAccount('non-existent-id')
      expect(account).toBeNull()
    })
  })

  describe('getUserAccount', () => {
    it('should return account for user', async () => {
      const mockAccount = createMockAccount()
      const mockUser = { account_id: mockAccount.id }
      
      // Mock users query (new system uses users.account_id)
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        if (table === 'users') {
          return {
            ...createMockSupabaseClient().from('users'),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
          } as any
        }
        // Mock accounts query
        const mockAccountQueryBuilder = createMockSupabaseClient().from('accounts')
        return {
          ...mockAccountQueryBuilder,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockAccount, error: null })
        } as any
      })

      const account = await accountService.getUserAccount('user-id')
      expect(account).toBeTruthy()
      expect(account?.id).toBe(mockAccount.id)
    })

    it('should return null when user has no account', async () => {
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...createMockSupabaseClient().from('users'),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { account_id: null }, error: null })
      } as any)

      const account = await accountService.getUserAccount('user-id')
      expect(account).toBeNull()
    })
  })

  describe('assignUserToAccount', () => {
    it('should assign user to account', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('users')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await expect(
        accountService.assignUserToAccount('user-id', 'account-id')
      ).resolves.not.toThrow()
    })
  })

  describe('removeUserFromAccount', () => {
    it('should remove user from account', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('users')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await expect(
        accountService.removeUserFromAccount('user-id')
      ).resolves.not.toThrow()
    })
  })

  describe('getAccountUsers', () => {
    it('should return account users', async () => {
      const mockUsers = [
        { id: 'user-1', account_id: 'account-id', role: 'admin', email: 'user1@test.com', full_name: 'User 1', created_at: new Date().toISOString(), last_login: new Date().toISOString() },
        { id: 'user-2', account_id: 'account-id', role: 'user', email: 'user2@test.com', full_name: 'User 2', created_at: new Date().toISOString(), last_login: new Date().toISOString() }
      ]
      const mockQueryBuilder = createMockSupabaseClient().from('users')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockUsers, error: null })
      } as any)

      const users = await accountService.getAccountUsers('account-id')
      expect(users).toHaveLength(2)
      expect(users[0].id).toBe('user-1')
      expect(users[0].role).toBe('admin')
    })
  })

  describe('isAccountMember', () => {
    it('should return true when user is member', async () => {
      const mockUser = { role: 'admin', account_id: 'account-id' }
      const mockQueryBuilder = createMockSupabaseClient().from('users')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
      } as any)

      const isMember = await accountService.isAccountMember('user-id', 'account-id')
      expect(isMember).toBe(true)
    })

    it('should return true when user is system owner', async () => {
      const mockUser = { role: 'owner', account_id: null }
      const mockQueryBuilder = createMockSupabaseClient().from('users')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
      } as any)

      const isMember = await accountService.isAccountMember('user-id', 'account-id')
      expect(isMember).toBe(true) // System owners can access all accounts
    })

    it('should return false when user is not member', async () => {
      const mockUser = { role: 'user', account_id: 'different-account-id' }
      const mockQueryBuilder = createMockSupabaseClient().from('users')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser, error: null })
      } as any)

      const isMember = await accountService.isAccountMember('user-id', 'account-id')
      expect(isMember).toBe(false)
    })
  })

  describe('getAllAccounts', () => {
    it('should return all accounts', async () => {
      const mockAccounts = [
        createMockAccount({ id: 'account-1', name: 'Account 1' }),
        createMockAccount({ id: 'account-2', name: 'Account 2' })
      ]
      const mockQueryBuilder = createMockSupabaseClient().from('accounts')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockAccounts, error: null })
      } as any)

      const accounts = await accountService.getAllAccounts()
      expect(accounts).toHaveLength(2)
      expect(accounts[0].name).toBe('Account 1')
    })
  })
})

