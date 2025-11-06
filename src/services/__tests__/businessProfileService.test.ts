import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createNotFoundError } from './test-utils'

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
import { businessProfileService } from '../businessProfileService'
import * as supabaseModule from '../supabase'

describe('businessProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBusinessProfile', () => {
    it('should return business profile when found', async () => {
      const mockProfile = {
        account_id: 'test-account-id',
        name: 'Test Business',
        logo_url: 'https://example.com/logo.png',
        updated_at: new Date().toISOString(),
        updated_by: 'user-id'
      }
      const mockQueryBuilder = createMockSupabaseClient().from('business_profiles')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
      } as any)

      const profile = await businessProfileService.getBusinessProfile('test-account-id')
      expect(profile).toBeTruthy()
      expect(profile?.accountId).toBe('test-account-id')
      expect(profile?.name).toBe('Test Business')
      expect(profile?.logoUrl).toBe('https://example.com/logo.png')
    })

    it('should return null when profile not found', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('business_profiles')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
      } as any)

      const profile = await businessProfileService.getBusinessProfile('non-existent-id')
      expect(profile).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      const error = { code: '500', message: 'Server error', details: null, hint: null }
      const mockQueryBuilder = createMockSupabaseClient().from('business_profiles')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error })
      } as any)

      const profile = await businessProfileService.getBusinessProfile('test-account-id')
      expect(profile).toBeNull()
    })
  })

  describe('updateBusinessProfile', () => {
    it('should create new profile when it does not exist', async () => {
      const notFoundError = createNotFoundError()
      let insertCalled = false
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        const mockQueryBuilder = createMockSupabaseClient().from(table)
        if (table === 'business_profiles') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: notFoundError }),
            insert: vi.fn().mockImplementation(() => {
              insertCalled = true
              return Promise.resolve({ data: null, error: null })
            })
          } as any
        }
        return mockQueryBuilder as any
      })

      await businessProfileService.updateBusinessProfile(
        'test-account-id',
        'Test Business',
        'https://example.com/logo.png',
        'user-id'
      )

      expect(insertCalled).toBe(true)
    })

    it('should update existing profile', async () => {
      const existingProfile = { account_id: 'test-account-id' }
      let updateCalled = false
      
      // Create an awaitable chain for the update operation
      const awaitableUpdateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((onResolve?: (value: any) => any) => {
          updateCalled = true
          return Promise.resolve({ data: null, error: null }).then(onResolve)
        }),
        catch: vi.fn((onReject?: (error: any) => any) => {
          return Promise.resolve({ data: null, error: null }).catch(onReject)
        })
      }
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        const mockQueryBuilder = createMockSupabaseClient().from(table)
        if (table === 'business_profiles') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: existingProfile, error: null }),
            update: vi.fn().mockReturnValue(awaitableUpdateChain)
          } as any
        }
        return mockQueryBuilder as any
      })

      await businessProfileService.updateBusinessProfile(
        'test-account-id',
        'Updated Business',
        'https://example.com/new-logo.png',
        'user-id'
      )

      expect(updateCalled).toBe(true)
    })

    it('should handle null logo URL', async () => {
      const notFoundError = createNotFoundError()
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        const mockQueryBuilder = createMockSupabaseClient().from(table)
        return {
          ...mockQueryBuilder,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: notFoundError }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        } as any
      })

      await expect(
        businessProfileService.updateBusinessProfile(
          'test-account-id',
          'Test Business',
          null,
          'user-id'
        )
      ).resolves.not.toThrow()
    })

    it('should throw error on failure', async () => {
      const error = { code: '500', message: 'Server error', details: null, hint: null }
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation((table) => {
        const mockQueryBuilder = createMockSupabaseClient().from(table)
        return {
          ...mockQueryBuilder,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error }),
          insert: vi.fn().mockResolvedValue({ data: null, error })
        } as any
      })

      await expect(
        businessProfileService.updateBusinessProfile(
          'test-account-id',
          'Test Business',
          'https://example.com/logo.png',
          'user-id'
        )
      ).rejects.toEqual(error)
    })
  })
})

