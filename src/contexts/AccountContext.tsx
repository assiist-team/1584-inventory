import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react'
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

    const loadAccount = async () => {
      // Back off if auth is still loading or user is not ready
      if (authLoading || !user) {
        if (isMounted) {
          // If auth is loading, keep our loading state true
          // If no user, clear account and set loading to false
          if (!user) {
            setCurrentAccountId(null)
            setCurrentAccount(null)
            setLoading(false)
          } else {
            setLoading(true)
          }
        }
        return
      }

      // If we have a user and auth is ready, we start the loading process.
      if (isMounted) {
        setLoading(true)
      }

      // Safety timeout to ensure loading is set to false even if account loading fails
      const loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('⚠️ Account loading timeout - setting loading to false')
          setLoading(false)
        }
      }, 10000) // 10 second timeout

      try {
        let finalAccount: Account | null = null

        // 1. Try getting account from user object's accountId
        if (user.accountId) {
          finalAccount = await accountService.getAccount(user.accountId)
        }

        // 2. If not found, try fetching from the users table (fallback)
        if (!finalAccount) {
          finalAccount = await accountService.getUserAccount(user.id)
        }

        // 3. If still not found and user is an owner, get the first account
        if (!finalAccount && isOwner) {
          const allAccounts = await accountService.getAllAccounts()
          if (allAccounts.length > 0) {
            finalAccount = allAccounts[0]
          }
        }
        
        // Now, update the state based on what was found.
        if (isMounted) {
          if (finalAccount) {
            setCurrentAccountId(finalAccount.id)
            setCurrentAccount(finalAccount)
          } else {
            setCurrentAccountId(null)
            setCurrentAccount(null)
          }
        }
      } catch (error) {
        console.error('Error loading account:', error)
        if (isMounted) {
          setCurrentAccountId(null)
          setCurrentAccount(null)
        }
      } finally {
        clearTimeout(loadingTimeout)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAccount()

    return () => {
      isMounted = false
    }
  }, [user, authLoading, isOwner])

  const value: AccountContextType = useMemo(() => ({
    currentAccountId,
    currentAccount,
    isOwner,
    isAdmin,
    loading
  }), [currentAccountId, currentAccount, isOwner, isAdmin, loading])

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

