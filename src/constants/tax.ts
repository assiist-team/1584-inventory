export type SupportedTaxState = 'NV' | 'UT'

// Configure the NV and UT tax rates here (percentages)
export const STATE_TAX_RATE_PCT: Record<SupportedTaxState, number> = {
  NV: 8.375, // Nevada example rate
  UT: 7.10   // Utah example rate
}

export const isSupportedTaxState = (v: any): v is SupportedTaxState => v === 'NV' || v === 'UT'

export const SUPPORTED_TAX_STATES = ['NV', 'UT', 'Other'] as const

export type TaxStateOption = typeof SUPPORTED_TAX_STATES[number]


