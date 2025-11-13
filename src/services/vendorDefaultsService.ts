import { TRANSACTION_SOURCES } from '@/constants/transactionSources'
import { getAccountPresets, upsertAccountPresets } from './accountPresetsService'

export interface VendorSlot {
  id: string | null
  name: string | null
}

export interface VendorDefaultsResponse {
  slots: VendorSlot[]
}

/**
 * Get vendor defaults from Postgres for an account
 * Returns exactly 10 slots (may contain null values)
 */
export async function getVendorDefaults(accountId: string): Promise<VendorDefaultsResponse> {
  try {
    // Read canonical vendor_defaults from account_presets
    const ap = await getAccountPresets(accountId)
    const migrated: any[] | undefined = ap?.presets?.vendor_defaults
    if (Array.isArray(migrated)) {
      const rawSlots: any[] = migrated.slice()
      while (rawSlots.length < 10) rawSlots.push(null)
      const truncated = rawSlots.slice(0, 10)
      const slots: VendorSlot[] = truncated.map(slot => {
        if (typeof slot === 'string') return { id: slot, name: slot }
        return { id: null, name: null }
      })
      return { slots }
    }

    // Initialize vendor defaults from TRANSACTION_SOURCES if missing
    const initialStoredSlots: Array<string | null> = TRANSACTION_SOURCES.slice(0, 10).map(name => name)
    while (initialStoredSlots.length < 10) initialStoredSlots.push(null)
    try {
      await upsertAccountPresets(accountId, { presets: { vendor_defaults: initialStoredSlots } })
    } catch (err) {
      console.warn('Failed to initialize vendor_defaults in account_presets:', err)
    }
    const initialSlots = initialStoredSlots.map(s => (s ? { id: s, name: s } : { id: null, name: null }))
    return { slots: initialSlots }
  } catch (error) {
    console.error('Error fetching vendor defaults from Postgres:', error)
    // Fallback to first 10 from TRANSACTION_SOURCES
    const fallbackStored: Array<string | null> = TRANSACTION_SOURCES.slice(0, 10).map(name => name)
    while (fallbackStored.length < 10) {
      fallbackStored.push(null)
    }
    const fallbackSlots = fallbackStored.map(s => (s ? { id: s, name: s } : { id: null, name: null }))
    return { slots: fallbackSlots }
  }
}

/**
 * Update a single vendor slot (index 1-10)
 * @param accountId Account ID
 * @param slotIndex Slot index (1-10)
 * @param vendorId Vendor name/id or null to clear
 */
export async function updateVendorSlot(
  accountId: string,
  slotIndex: number,
  vendorId: string | null,
  updatedBy?: string
): Promise<void> {
  if (slotIndex < 1 || slotIndex > 10) {
    throw new Error('Slot index must be between 1 and 10')
  }

  try {
    // Get current slots (normalized)
    const current = await getVendorDefaults(accountId)
    // Convert to stored-format array (string | null)
    const storedSlots: Array<string | null> = current.slots.map(s => (s.id ? s.id : null))

    // Update the specific slot (1-based -> 0-based)
    storedSlots[slotIndex - 1] = vendorId ? vendorId : null

    // Update all slots in stored-format
    await updateVendorDefaults(accountId, storedSlots, updatedBy)
  } catch (error) {
    console.error('Error updating vendor slot:', error)
    throw error
  }
}

/**
 * Update all vendor defaults in Postgres for an account
 * @param accountId Account ID
 * @param slots Array of exactly 10 vendor slots
 * @param updatedBy Optional user ID who made the update
 */
export async function updateVendorDefaults(
  accountId: string,
  slots: Array<string | null>,
  updatedBy?: string
): Promise<void> {
  try {
    // Validate slots
    if (!Array.isArray(slots)) {
      throw new Error('Slots must be an array')
    }

    if (slots.length !== 10) {
      throw new Error('Must have exactly 10 slots')
    }

    // Normalize slots to stored-format: plain strings or null
    const storedSlots: Array<string | null> = slots.map(slot => {
      if (typeof slot === 'string') {
        return slot
      }
      if (slot === null) {
        return null
      }
      // Reject any non-string/non-null input to enforce no backwards compatibility
      throw new Error('Slots must be plain strings or null (legacy object formats are not supported)')
    })
    // Persist exclusively to canonical account_presets
    await upsertAccountPresets(accountId, { presets: { vendor_defaults: storedSlots } })
    console.log('Vendor defaults updated successfully (account_presets)')
  } catch (error) {
    console.error('Error updating vendor defaults:', error)
    throw error
  }
}

/**
 * Get list of available vendors (non-null slots) for transaction forms
 * This filters out empty slots and returns only configured vendors
 */
export async function getAvailableVendors(accountId: string): Promise<string[]> {
  const defaults = await getVendorDefaults(accountId)
  return defaults.slots
    .filter(slot => slot.id && slot.name)
    .map(slot => slot.name!)
}

