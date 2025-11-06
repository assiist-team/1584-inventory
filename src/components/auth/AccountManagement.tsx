import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { accountService } from '../../services/accountService'
import { Button } from '../ui/Button'
import { Building2, Plus, Shield } from 'lucide-react'
import { Account } from '../../types'
import { useToast } from '../ui/ToastContext'

interface AccountManagementProps {
  className?: string
}

export default function AccountManagement({ className }: AccountManagementProps) {
  const { user, isOwner } = useAuth()
  const { showSuccess, showError } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOwner()) {
      loadAccounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError('')
      const accountsData = await accountService.getAllAccounts()
      setAccounts(accountsData)
    } catch (err) {
      console.error('Error loading accounts:', err)
      setError('Failed to load accounts')
      showError('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const createAccount = async () => {
    if (!newAccountName.trim() || !user) return

    try {
      setCreating(true)
      setError('')
      
      const accountId = await accountService.createAccount(
        newAccountName.trim(),
        user.id
      )

      showSuccess(`Account "${newAccountName.trim()}" created successfully`)
      setNewAccountName('')
      await loadAccounts() // Refresh the list
    } catch (err) {
      console.error('Error creating account:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account'
      setError(errorMessage)
      showError(errorMessage)
    } finally {
      setCreating(false)
    }
  }

  if (!isOwner()) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            Only app owners can manage accounts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <Building2 className="h-8 w-8 text-gray-400" />
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-gray-900">
            Account Management
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage accounts in the system
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      {/* Create Account Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Create New Account</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Enter account name"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newAccountName.trim() && !creating) {
                  createAccount()
                }
              }}
            />
          </div>
          <Button
            onClick={createAccount}
            disabled={creating || !newAccountName.trim()}
            className="w-full flex items-center justify-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>{creating ? 'Creating...' : 'Create Account'}</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Accounts are used to organize projects and data. Each account can have multiple members with different roles.
        </p>
      </div>

      {/* Accounts List */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">All Accounts</h3>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">
                No accounts found. Create your first account above.
              </div>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{account.name}</div>
                      <div className="text-xs text-gray-500">
                        Created {account.createdAt instanceof Date 
                          ? account.createdAt.toLocaleDateString()
                          : new Date(account.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    ID: {account.id.substring(0, 8)}...
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

