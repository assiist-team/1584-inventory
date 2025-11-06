import { supabase } from './supabase'
import { DEFAULT_TAX_PRESETS, TaxPreset } from '@/constants/taxPresets'

/**
 * Get tax presets from Postgres for an account, falling back to defaults if not found
 */
export async function getTaxPresets(accountId: string): Promise<TaxPreset[]> {
  try {
    const { data, error } = await supabase
      .from('tax_presets')
      .select('presets')
      .eq('account_id', accountId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - initialize with defaults
        await updateTaxPresets(accountId, DEFAULT_TAX_PRESETS)
        return DEFAULT_TAX_PRESETS
      }
      throw error
    }

    if (data.presets && Array.isArray(data.presets) && data.presets.length > 0) {
      return data.presets as TaxPreset[]
    }

    // If presets array is empty, initialize with defaults
    await updateTaxPresets(accountId, DEFAULT_TAX_PRESETS)
    return DEFAULT_TAX_PRESETS
  } catch (error) {
    console.error('Error fetching tax presets from Postgres:', error)
    // Fallback to defaults on error
    return DEFAULT_TAX_PRESETS
  }
}

/**
 * Update tax presets in Postgres for an account
 * @param accountId Account ID
 * @param presets Array of tax presets to save
 */
export async function updateTaxPresets(accountId: string, presets: TaxPreset[]): Promise<void> {
  try {
    // Validate presets
    if (!Array.isArray(presets) || presets.length === 0) {
      throw new Error('Presets must be a non-empty array')
    }

    if (presets.length > 5) {
      throw new Error('Cannot have more than 5 tax presets')
    }

    // Validate each preset
    for (const preset of presets) {
      if (!preset.id || !preset.name || typeof preset.rate !== 'number') {
        throw new Error('Each preset must have id, name, and rate fields')
      }
      if (preset.rate < 0 || preset.rate > 100) {
        throw new Error('Tax rate must be between 0 and 100')
      }
    }

    // Check for duplicate IDs
    const ids = presets.map(p => p.id)
    if (new Set(ids).size !== ids.length) {
      throw new Error('Preset IDs must be unique')
    }

    // Check if presets exist for this account
    const { data: existing, error: checkError } = await supabase
      .from('tax_presets')
      .select('account_id')
      .eq('account_id', accountId)
      .single()

    // Handle "not found" error gracefully - it means we need to insert
    const shouldInsert = !existing || (checkError && checkError.code === 'PGRST116')

    const presetData = {
      account_id: accountId,
      presets: presets,
      updated_at: new Date().toISOString()
    }

    if (!shouldInsert) {
      // Update existing
      const { error } = await supabase
        .from('tax_presets')
        .update(presetData)
        .eq('account_id', accountId)

      if (error) throw error
    } else {
      // Create new
      const { error } = await supabase
        .from('tax_presets')
        .insert(presetData)

      if (error) throw error
    }

    console.log('Tax presets updated successfully')
  } catch (error) {
    console.error('Error updating tax presets:', error)
    throw error
  }
}

/**
 * Get a specific preset by ID for an account
 */
export async function getTaxPresetById(accountId: string, presetId: string): Promise<TaxPreset | null> {
  const presets = await getTaxPresets(accountId)
  return presets.find(p => p.id === presetId) || null
}

