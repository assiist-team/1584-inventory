import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createMockAccount, createMockUser, createNotFoundError } from './test-utils'

// Mock Supabase before importing services
const mockSupabase = createMockSupabaseClient()
vi.mock('../supabase', () => ({
  supabase: mockSupabase
}))

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
      const mockMembership = { account_id: mockAccount.id }
      
      // Mock account_members query
      const mockMembersQueryBuilder = createMockSupabaseClient().from('account_members')
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        if (table === 'account_members') {
          return {
            ...mockMembersQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockMembership, error: null })
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
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      const account = await accountService.getUserAccount('user-id')
      expect(account).toBeNull()
    })
  })

  describe('getUserRoleInAccount', () => {
    it('should return user role', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
      } as any)

      const role = await accountService.getUserRoleInAccount('user-id', 'account-id')
      expect(role).toBe('admin')
    })

    it('should return null when user is not member', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
      } as any)

      const role = await accountService.getUserRoleInAccount('user-id', 'account-id')
      expect(role).toBeNull()
    })
  })

  describe('addUserToAccount', () => {
    it('should add user to account', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await expect(
        accountService.addUserToAccount('user-id', 'account-id', 'admin')
      ).resolves.not.toThrow()
    })
  })

  describe('updateUserRoleInAccount', () => {
    it('should update user role', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await expect(
        accountService.updateUserRoleInAccount('user-id', 'account-id', 'user')
      ).resolves.not.toThrow()
    })
  })

  describe('removeUserFromAccount', () => {
    it('should remove user from account', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await expect(
        accountService.removeUserFromAccount('user-id', 'account-id')
      ).resolves.not.toThrow()
    })
  })

  describe('getAccountMembers', () => {
    it('should return account members', async () => {
      const mockMembers = [
        { user_id: 'user-1', account_id: 'account-id', role: 'admin', joined_at: new Date().toISOString() },
        { user_id: 'user-2', account_id: 'account-id', role: 'user', joined_at: new Date().toISOString() }
      ]
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
      } as any)

      const members = await accountService.getAccountMembers('account-id')
      expect(members).toHaveLength(2)
      expect(members[0].userId).toBe('user-1')
      expect(members[0].role).toBe('admin')
    })
  })

  describe('isAccountMember', () => {
    it('should return true when user is member', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { user_id: 'user-id' }, error: null })
      } as any)

      const isMember = await accountService.isAccountMember('user-id', 'account-id')
      expect(isMember).toBe(true)
    })

    it('should return false when user is not member', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('account_members')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
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

