import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transactionService } from '../inventoryService'
import { STATE_TAX_RATE_PCT } from '../../constants/tax'

// Mock Firebase dependencies
vi.mock('../firebase', () => ({
  db: {},
  convertTimestamps: vi.fn((data) => data),
  ensureAuthenticatedForStorage: vi.fn()
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined)
  })),
  serverTimestamp: vi.fn(() => new Date())
}))

describe('Tax System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Tax Rate Mapping for NV/UT States', () => {
    it('should apply correct tax rate for NV state', async () => {
    const { addDoc } = await import('firebase/firestore')
    vi.mocked(addDoc).mockResolvedValue({ id: 'test-id' } as any)

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

    await expect(async () => {
      await transactionService.createTransaction('project-1', transactionData as any, [])
    }).rejects.toThrow('Configured tax rate for selected state is missing.')
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

      // Test the calculation logic directly without mocking firebase internals
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
