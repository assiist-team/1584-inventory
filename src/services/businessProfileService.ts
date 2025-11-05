import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, convertTimestamps } from './firebase'
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
      const profileRef = doc(db, 'accounts', accountId, 'businessProfile', 'profile')
      const profileSnap = await getDoc(profileRef)

      if (profileSnap.exists()) {
        const data = convertTimestamps(profileSnap.data())
        return {
          ...data
        } as BusinessProfile
      }
      return null
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
      const profileRef = doc(db, 'accounts', accountId, 'businessProfile', 'profile')
      
      const profileData: BusinessProfile = {
        name,
        logoUrl,
        updatedAt: new Date(),
        updatedBy,
        accountId
      }

      await setDoc(profileRef, {
        ...profileData,
        updatedAt: new Date()
      }, { merge: true })

      console.log('Business profile updated successfully')
    } catch (error) {
      console.error('Error updating business profile:', error)
      throw error
    }
  }
}

