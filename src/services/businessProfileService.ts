import { supabase } from './supabase'
import { convertTimestamps } from './databaseService'
import { BusinessProfile } from '@/types'

/**
 * Business Profile Service - Manages business profile data for accounts
 */
export const businessProfileService = {
  /**
   * Get business profile for an account
   */
  async getBusinessProfile(accountId: string): Promise<BusinessProfile | null> {
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('account_id', accountId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      const profileData = convertTimestamps(data)
      return {
        accountId: profileData.account_id,
        name: profileData.name,
        logoUrl: profileData.logo_url,
        updatedAt: profileData.updated_at,
        updatedBy: profileData.updated_by
      } as BusinessProfile
    } catch (error) {
      console.error('Error fetching business profile:', error)
      return null
    }
  },

  /**
   * Update business profile for an account
   */
  async updateBusinessProfile(
    accountId: string,
    name: string,
    logoUrl: string | null,
    updatedBy: string
  ): Promise<void> {
    try {
      // Check if profile exists
      const { data: existing, error: checkError } = await supabase
        .from('business_profiles')
        .select('account_id')
        .eq('account_id', accountId)
        .single()

      // If there's an error checking and it's not "not found", throw it
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      const profileData = {
        account_id: accountId,
        name,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      }

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('business_profiles')
          .update(profileData)
          .eq('account_id', accountId)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('business_profiles')
          .insert(profileData)

        if (error) throw error
      }

      console.log('Business profile updated successfully')
    } catch (error) {
      console.error('Error updating business profile:', error)
      throw error
    }
  }
}

