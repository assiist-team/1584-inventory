import { describe, it, expect } from 'vitest'
import { STATE_TAX_RATE_PCT, isSupportedTaxState } from '../tax'

describe('Tax Constants', () => {
  describe('STATE_TAX_RATE_PCT', () => {
    it('should have valid tax rates for supported states', () => {
      expect(STATE_TAX_RATE_PCT.NV).toBeGreaterThan(0)
      expect(STATE_TAX_RATE_PCT.UT).toBeGreaterThan(0)
      expect(typeof STATE_TAX_RATE_PCT.NV).toBe('number')
      expect(typeof STATE_TAX_RATE_PCT.UT).toBe('number')
    })

    it('should have reasonable tax rates (between 0% and 20%)', () => {
      expect(STATE_TAX_RATE_PCT.NV).toBeGreaterThan(0)
      expect(STATE_TAX_RATE_PCT.NV).toBeLessThan(20)
      expect(STATE_TAX_RATE_PCT.UT).toBeGreaterThan(0)
      expect(STATE_TAX_RATE_PCT.UT).toBeLessThan(20)
    })
  })

  describe('isSupportedTaxState', () => {
    it('should return true for valid supported states', () => {
      expect(isSupportedTaxState('NV')).toBe(true)
      expect(isSupportedTaxState('UT')).toBe(true)
    })

    it('should return false for invalid states', () => {
      expect(isSupportedTaxState('CA')).toBe(false)
      expect(isSupportedTaxState('TX')).toBe(false)
      expect(isSupportedTaxState('')).toBe(false)
      expect(isSupportedTaxState(null)).toBe(false)
      expect(isSupportedTaxState(undefined)).toBe(false)
      expect(isSupportedTaxState('Other')).toBe(false)
    })
  })
})
