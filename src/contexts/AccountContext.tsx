import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { accountService } from '../services/accountService'
import { Account } from '../types'

interface AccountContextType {
  currentAccountId: string | null
  currentAccount: Account | null
  isOwner: boolean // System-level owner
  isAdmin: boolean // Account-level admin OR system owner
  loading: boolean
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

interface AccountProviderProps {
  children: ReactNode
}

export function AccountProvider({ children }: AccountProviderProps) {
  const { user, loading: authLoading } = useAuth()
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user is system owner
  const isOwner = user?.role === 'owner' || false
  
  // Check if user is account admin (admin role OR system owner)
  const isAdmin = isOwner || user?.role === 'admin' || false

  useEffect(() => {
    let isMounted = true
    let loadingTimeout: NodeJS.Timeout | null = null

    const loadAccount = async () => {
      if (!user) {
        setCurrentAccountId(null)
        setCurrentAccount(null)
        if (isMounted) {
          setLoading(false)
        }
        return
      }

      // Start loading only when user is available
      if (isMounted) {
        setLoading(true)
      }

      // Safety timeout to ensure loading is set to false even if account loading fails
      loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('⚠️ Account loading timeout - setting loading to false')
          setLoading(false)
        }
      }, 10000) // 10 second timeout

      try {
        // First check if user already has accountId from user object
        if (user.accountId) {
          const account = await accountService.getAccount(user.accountId)
          if (!isMounted) return
          
          if (account) {
            setCurrentAccountId(account.id)
            setCurrentAccount(account)
            return
          }
        }
        
        // Fallback: query database for account_id (for users created before migration)
        const account = await accountService.getUserAccount(user.id)
        
        if (!isMounted) return

        if (account) {
          setCurrentAccountId(account.id)
          setCurrentAccount(account)
        } else {
          // If no account found and user is owner, try to get first account
          if (isOwner) {
            const allAccounts = await accountService.getAllAccounts()
            if (allAccounts.length > 0) {
              setCurrentAccountId(allAccounts[0].id)
              setCurrentAccount(allAccounts[0])
              return
            }
          }
          setCurrentAccountId(null)
          setCurrentAccount(null)
        }
      } catch (error) {
        console.error('Error loading account:', error)
        if (isMounted) {
          setCurrentAccountId(null)
          setCurrentAccount(null)
        }
      } finally {
        if (loadingTimeout) {
          clearTimeout(loadingTimeout)
        }
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    if (authLoading) {
      setLoading(true)
      return
    }

    loadAccount()

    return () => {
      isMounted = false
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
    }
  }, [user, authLoading])

  const value: AccountContextType = {
    currentAccountId,
    currentAccount,
    isOwner,
    isAdmin,
    loading
  }

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return context
}

