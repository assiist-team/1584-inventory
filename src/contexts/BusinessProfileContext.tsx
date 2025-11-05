import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAccount } from './AccountContext'
import { businessProfileService } from '../services/businessProfileService'
import { BusinessProfile } from '../types'
import { COMPANY_NAME } from '@/constants/company'

interface BusinessProfileContextType {
  businessProfile: BusinessProfile | null
  businessName: string
  businessLogoUrl: string | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const BusinessProfileContext = createContext<BusinessProfileContextType | undefined>(undefined)

interface BusinessProfileProviderProps {
  children: ReactNode
}

export function BusinessProfileProvider({ children }: BusinessProfileProviderProps) {
  const { currentAccountId } = useAccount()
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async () => {
    if (!currentAccountId) {
      setBusinessProfile(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const profile = await businessProfileService.getBusinessProfile(currentAccountId)
      setBusinessProfile(profile)
    } catch (error) {
      console.error('Error loading business profile:', error)
      setBusinessProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [currentAccountId])

  // Derived values with fallbacks
  const businessName = businessProfile?.name || COMPANY_NAME
  const businessLogoUrl = businessProfile?.logoUrl || null

  const value: BusinessProfileContextType = {
    businessProfile,
    businessName,
    businessLogoUrl,
    loading,
    refreshProfile: loadProfile
  }

  return (
    <BusinessProfileContext.Provider value={value}>
      {children}
    </BusinessProfileContext.Provider>
  )
}

export function useBusinessProfile() {
  const context = useContext(BusinessProfileContext)
  if (context === undefined) {
    throw new Error('useBusinessProfile must be used within a BusinessProfileProvider')
  }
  return context
}

