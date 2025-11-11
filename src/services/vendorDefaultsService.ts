import { supabase } from './supabase'
import { TRANSACTION_SOURCES } from '@/constants/transactionSources'

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
    const { data, error } = await supabase
      .from('vendor_defaults')
      .select('slots')
      .eq('account_id', accountId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - initialize with first 10 from TRANSACTION_SOURCES (store as plain strings)
        const initialStoredSlots: Array<string | null> = TRANSACTION_SOURCES.slice(0, 10).map(name => name)
        while (initialStoredSlots.length < 10) {
          initialStoredSlots.push(null)
        }
        await updateVendorDefaults(accountId, initialStoredSlots)
        // Return the normalized VendorSlot[] for the UI
        const initialSlots = initialStoredSlots.map(s => (s ? { id: s, name: s } : { id: null, name: null }))
        return { slots: initialSlots }
      }
      throw error
    }

    // Ensure we have exactly 10 slots
    const rawSlots: any[] = Array.isArray(data?.slots) ? data.slots : []

    // Pad or truncate to exactly 10 slots
    while (rawSlots.length < 10) {
      rawSlots.push(null)
    }
    const truncated = rawSlots.slice(0, 10)

    // Normalize to VendorSlot[] (expect stored strings or null; no legacy object support)
    const slots: VendorSlot[] = truncated.map(slot => {
      if (typeof slot === 'string') {
        return { id: slot, name: slot }
      }
      // Anything other than a string is treated as empty (no object-based compatibility)
      return { id: null, name: null }
    })

    return { slots }
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

    // Check if vendor defaults exist for this account
    const { data: existing, error: checkError } = await supabase
      .from('vendor_defaults')
      .select('account_id')
      .eq('account_id', accountId)
      .single()

    // Handle "not found" error gracefully - it means we need to insert
    const shouldInsert = !existing || (checkError && checkError.code === 'PGRST116')

    const defaultsData: any = {
      account_id: accountId,
      slots: storedSlots,
      updated_at: new Date().toISOString()
    }

    if (updatedBy) {
      defaultsData.updated_by = updatedBy
    }

    if (!shouldInsert) {
      // Update existing
      const { error } = await supabase
        .from('vendor_defaults')
        .update(defaultsData)
        .eq('account_id', accountId)

      if (error) throw error
    } else {
      // Create new
      const { error } = await supabase
        .from('vendor_defaults')
        .insert(defaultsData)

      if (error) throw error
    }

    console.log('Vendor defaults updated successfully')
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

