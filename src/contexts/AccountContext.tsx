import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { accountService } from '../services/accountService'
import { Account, AccountMembership } from '../types'

interface AccountContextType {
  currentAccountId: string | null
  currentAccount: Account | null
  accountMembership: AccountMembership | null
  isOwner: boolean // System-level owner
  isAdmin: boolean // Account-level admin OR system owner
  userRole: 'admin' | 'user' | null // Account-level role
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
  const [accountMembership, setAccountMembership] = useState<AccountMembership | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user is system owner
  const isOwner = user?.role === 'owner' || false

  useEffect(() => {
    let isMounted = true
    let loadingTimeout: NodeJS.Timeout | null = null

    const loadAccount = async () => {
      if (!user) {
        setCurrentAccountId(null)
        setCurrentAccount(null)
        setAccountMembership(null)
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
        // Get user's account
        const account = await accountService.getUserAccount(user.id)
        
        if (!isMounted) return

        if (account) {
          setCurrentAccountId(account.id)
          setCurrentAccount(account)

          // Get user's role in account
          const role = await accountService.getUserRoleInAccount(user.id, account.id)
          
          if (!isMounted) return

          if (role) {
            setAccountMembership({
              userId: user.id,
              accountId: account.id,
              role,
              joinedAt: new Date() // Will be loaded from membership if needed
            })
          } else {
            setAccountMembership(null)
          }
        } else {
          setCurrentAccountId(null)
          setCurrentAccount(null)
          setAccountMembership(null)
        }
      } catch (error) {
        console.error('Error loading account:', error)
        if (isMounted) {
          setCurrentAccountId(null)
          setCurrentAccount(null)
          setAccountMembership(null)
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

  // Calculate derived values
  const userRole = accountMembership?.role || null
  const isAdmin = isOwner || userRole === 'admin'

  const value: AccountContextType = {
    currentAccountId,
    currentAccount,
    accountMembership,
    isOwner,
    isAdmin,
    userRole,
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

