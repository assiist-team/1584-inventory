import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createNotFoundError } from './test-utils'

// Mock Supabase before importing services
vi.mock('../supabase', async () => {
  const { createMockSupabaseClient } = await import('./test-utils')
  return {
    supabase: createMockSupabaseClient()
  }
})

// Import after mocks are set up
import { getTaxPresets, updateTaxPresets, getTaxPresetById } from '../taxPresetsService'
import { DEFAULT_TAX_PRESETS } from '../../constants/taxPresets'
import * as supabaseModule from '../supabase'
import * as accountPresetsModule from '../accountPresetsService'

describe('taxPresetsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTaxPresets', () => {
    it('should return presets from database', async () => {
      const mockPresets = [
        { id: 'preset-1', name: 'NV Tax', rate: 8.25 },
        { id: 'preset-2', name: 'UT Tax', rate: 6.85 }
      ]
      const mockData = { account_id: 'test-account-id', presets: mockPresets }
      // Simulate migrated data present in account_presets
      vi.mocked(accountPresetsModule.getAccountPresets).mockResolvedValue({
        presets: { tax_presets: mockPresets }
      } as any)
      const mockQueryBuilder = createMockSupabaseClient().from()
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null })
      } as any)

      const presets = await getTaxPresets('test-account-id')
      expect(presets).toEqual(mockPresets)
    })

    it('should initialize with defaults when not found', async () => {
      const notFoundError = createNotFoundError()
      let insertCalled = false
      // Ensure account_presets read returns null so legacy table path is exercised
      vi.mocked(accountPresetsModule.getAccountPresets).mockResolvedValue(null as any)
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation(() => {
        const mockQueryBuilder = createMockSupabaseClient().from()
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
      })

      const presets = await getTaxPresets('test-account-id')
      expect(presets).toEqual(DEFAULT_TAX_PRESETS)
      expect(insertCalled).toBe(true)
    })

    it('should initialize with defaults when presets array is empty', async () => {
      const mockData = { account_id: 'test-account-id', presets: [] }
      let updateCalled = false
      let callCount = 0
      
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
      
      // Ensure account_presets read returns null so legacy table path is exercised
      vi.mocked(accountPresetsModule.getAccountPresets).mockResolvedValue(null as any)
      vi.mocked(accountPresetsModule.upsertAccountPresets).mockResolvedValue(undefined as any)

      vi.mocked(supabaseModule.supabase.from).mockImplementation(() => {
        const mockQueryBuilder = createMockSupabaseClient().from()
        return {
          ...mockQueryBuilder,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            callCount++
            // First call: getTaxPresets finds empty presets
            if (callCount === 1) {
              return Promise.resolve({ data: mockData, error: null })
            }
            // Second call: updateTaxPresets checks if record exists (it does)
            return Promise.resolve({ data: { account_id: 'test-account-id' }, error: null })
          }),
          update: vi.fn().mockReturnValue(awaitableUpdateChain)
        } as any
      })

      const presets = await getTaxPresets('test-account-id')
      expect(presets).toEqual(DEFAULT_TAX_PRESETS)
      expect(updateCalled).toBe(true)
    })

    it('should fallback to defaults on error', async () => {
      const error = { code: '500', message: 'Server error', details: null, hint: null }
      // Simulate account_presets read throwing to exercise fallback
      vi.mocked(accountPresetsModule.getAccountPresets).mockRejectedValue(new Error('boom'))
      const mockQueryBuilder = createMockSupabaseClient().from()
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error })
      } as any)

      const presets = await getTaxPresets('test-account-id')
      expect(presets).toEqual(DEFAULT_TAX_PRESETS)
    })
  })

  describe('updateTaxPresets', () => {
    it('should update existing presets', async () => {
      const existingPresets = { account_id: 'test-account-id' }
      const newPresets = [
        { id: 'preset-1', name: 'NV Tax', rate: 8.25 },
        { id: 'preset-2', name: 'UT Tax', rate: 6.85 }
      ]
      let updateCalled = false
      
      // Make sure account_presets upsert doesn't reject during test
      vi.mocked(accountPresetsModule.upsertAccountPresets).mockResolvedValue(undefined as any)

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
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation(() => {
        const mockQueryBuilder = createMockSupabaseClient().from()
        return {
          ...mockQueryBuilder,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: existingPresets, error: null }),
          update: vi.fn().mockReturnValue(awaitableUpdateChain)
        } as any
      })

      await updateTaxPresets('test-account-id', newPresets)
      expect(updateCalled).toBe(true)
    })

    it('should create new presets when they do not exist', async () => {
      const notFoundError = createNotFoundError()
      const newPresets = [
        { id: 'preset-1', name: 'NV Tax', rate: 8.25 }
      ]
      let insertCalled = false
      // Ensure account_presets upsert is stubbed
      vi.mocked(accountPresetsModule.upsertAccountPresets).mockResolvedValue(undefined as any)
      
      vi.mocked(supabaseModule.supabase.from).mockImplementation(() => {
        const mockQueryBuilder = createMockSupabaseClient().from()
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
      })

      await updateTaxPresets('test-account-id', newPresets)
      expect(insertCalled).toBe(true)
    })

    it('should validate presets array is not empty', async () => {
      await expect(
        updateTaxPresets('test-account-id', [])
      ).rejects.toThrow('Presets must be a non-empty array')
    })

    it('should validate maximum of 5 presets', async () => {
      const tooManyPresets = Array.from({ length: 6 }, (_, i) => ({
        id: `preset-${i}`,
        name: `Preset ${i}`,
        rate: 5.0
      }))

      await expect(
        updateTaxPresets('test-account-id', tooManyPresets)
      ).rejects.toThrow('Cannot have more than 5 tax presets')
    })

    it('should validate preset structure', async () => {
      const invalidPresets = [
        { id: 'preset-1', name: 'Test' } // Missing rate
      ]

      await expect(
        updateTaxPresets('test-account-id', invalidPresets as any)
      ).rejects.toThrow('Each preset must have id, name, and rate fields')
    })

    it('should validate tax rate range', async () => {
      const invalidPresets = [
        { id: 'preset-1', name: 'Test', rate: 150 } // Rate > 100
      ]

      await expect(
        updateTaxPresets('test-account-id', invalidPresets)
      ).rejects.toThrow('Tax rate must be between 0 and 100')
    })

    it('should validate unique preset IDs', async () => {
      const duplicatePresets = [
        { id: 'preset-1', name: 'Test 1', rate: 5.0 },
        { id: 'preset-1', name: 'Test 2', rate: 6.0 } // Duplicate ID
      ]

      await expect(
        updateTaxPresets('test-account-id', duplicatePresets)
      ).rejects.toThrow('Preset IDs must be unique')
    })
  })

  describe('getTaxPresetById', () => {
    it('should return preset by ID', async () => {
      const mockPresets = [
        { id: 'preset-1', name: 'NV Tax', rate: 8.25 },
        { id: 'preset-2', name: 'UT Tax', rate: 6.85 }
      ]
      const mockData = { account_id: 'test-account-id', presets: mockPresets }
      const mockQueryBuilder = createMockSupabaseClient().from()
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null })
      } as any)

      const preset = await getTaxPresetById('test-account-id', 'preset-1')
      expect(preset).toBeTruthy()
      expect(preset?.id).toBe('preset-1')
      expect(preset?.name).toBe('NV Tax')
    })

    it('should return null when preset not found', async () => {
      const mockPresets = [
        { id: 'preset-1', name: 'NV Tax', rate: 8.25 }
      ]
      const mockData = { account_id: 'test-account-id', presets: mockPresets }
      const mockQueryBuilder = createMockSupabaseClient().from()
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null })
      } as any)

      const preset = await getTaxPresetById('test-account-id', 'non-existent-id')
      expect(preset).toBeNull()
    })
  })
})

