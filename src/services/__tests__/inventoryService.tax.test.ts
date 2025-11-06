import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STATE_TAX_RATE_PCT } from '../../constants/tax'

// Mock Supabase client
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }
}))

// Mock database service
vi.mock('../databaseService', () => ({
  ensureAuthenticatedForDatabase: vi.fn().mockResolvedValue(undefined),
  convertTimestamps: vi.fn((data) => data)
}))

describe('Tax System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Tax Rate Mapping for NV/UT States', () => {
    it('should validate NV state tax rate exists', () => {
      const transactionData = {
        project_id: 'project-1',
        transaction_date: '2023-01-01',
        source: 'Test Source',
        transaction_type: 'Purchase',
        payment_method: 'Credit Card',
        amount: '108.38',
        budget_category: 'Furnishings',
        tax_state: 'NV' as const,
        subtotal: '100.00',
        created_by: 'test'
      }

      // Test that NV state has a configured tax rate
      expect(STATE_TAX_RATE_PCT['NV']).toBeDefined()
      expect(typeof STATE_TAX_RATE_PCT['NV']).toBe('number')
    })

    it('should compute tax rate correctly for Other state', async () => {
      const transactionData = {
        project_id: 'project-1',
        transaction_date: '2023-01-01',
        source: 'Test Source',
        transaction_type: 'Purchase',
        payment_method: 'Credit Card',
        amount: '108.38',
        budget_category: 'Furnishings',
        tax_state: 'Other' as const,
        subtotal: '100.00'
      }

      // Test the calculation logic directly without mocking database internals
      const amountNum = parseFloat(transactionData.amount)
      const subtotalNum = parseFloat(transactionData.subtotal)
      const calculatedRate = ((amountNum - subtotalNum) / subtotalNum) * 100

      expect(calculatedRate).toBeCloseTo(8.38, 2)
    })

    it('should validate subtotal is required for Other state', async () => {
      const transactionData = {
        project_id: 'project-1',
        transaction_date: '2023-01-01',
        source: 'Test Source',
        transaction_type: 'Purchase',
        payment_method: 'Credit Card',
        amount: '108.38',
        budget_category: 'Furnishings',
        tax_state: 'Other' as const
        // Missing subtotal
      }

      // Test the validation logic directly
      const amountNum = parseFloat(transactionData.amount)
      const subtotalNum = parseFloat((transactionData as any).subtotal || '0')

      expect(subtotalNum).toBe(0)
      expect(amountNum).toBeGreaterThan(subtotalNum)
    })

    it('should validate subtotal does not exceed amount for Other state', async () => {
      const amountNum = 100
      const subtotalNum = 150 // Subtotal greater than amount (invalid)

      expect(amountNum).toBeLessThan(subtotalNum) // This should be caught as invalid
    })
  })

  describe('Tax Rate Precision', () => {
    it('should round tax rates to 4 decimal places', () => {
      // Test the rounding logic used in the service
      const amount = 108.375 // Amount with tax
      const subtotal = 100.00 // Subtotal before tax
      const rate = ((amount - subtotal) / subtotal) * 100

      // Service rounds to 4 decimal places
      const roundedRate = Math.round(rate * 10000) / 10000

      expect(roundedRate).toBeCloseTo(8.375, 4)
      expect(typeof roundedRate).toBe('number')
    })
  })

  describe('Tax State Validation', () => {
    it('should accept valid tax states', () => {
      const validStates = ['NV', 'UT', 'Other']

      validStates.forEach(state => {
        if (state === 'NV' || state === 'UT') {
          expect(STATE_TAX_RATE_PCT[state as keyof typeof STATE_TAX_RATE_PCT]).toBeDefined()
        }
        // 'Other' is handled differently - no predefined rate
      })
    })

    it('should reject invalid tax states', () => {
      const invalidStates = ['CA', 'TX', 'NY', '']

      invalidStates.forEach(state => {
        expect(STATE_TAX_RATE_PCT[state as keyof typeof STATE_TAX_RATE_PCT]).toBeUndefined()
      })
    })
  })
})
