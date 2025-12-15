import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { accountService } from '../../services/accountService'
import { Button } from '../ui/Button'
import { Building2, Plus, Shield, Copy, Check, X, ChevronDown, ChevronUp, Mail } from 'lucide-react'
import { Account, UserRole } from '../../types'
import { useToast } from '../ui/ToastContext'
import { createUserInvitation, getAllPendingInvitationsForAccounts } from '../../services/supabase'

interface AccountManagementProps {
  className?: string
}

export default function AccountManagement({ className }: AccountManagementProps) {
  const { user, isOwner, loading: authLoading, userLoading } = useAuth()
  const { showSuccess, showError } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [firstUserEmail, setFirstUserEmail] = useState('')
  const [error, setError] = useState('')
  const [lastInvitationLink, setLastInvitationLink] = useState<string | null>(null)
  const [lastInvitationEmail, setLastInvitationEmail] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [accountInvitations, setAccountInvitations] = useState<Record<string, Array<{
    id: string;
    email: string;
    role: 'admin' | 'user';
    token: string;
    createdAt: string;
    expiresAt: string;
  }>>>({})
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [copiedTokens, setCopiedTokens] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (authLoading || userLoading) {
      return // Wait for authentication to complete
    }
    if (isOwner()) {
      loadAccounts()
    } else {
      setLoading(false) // Not an owner, stop loading
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userLoading, isOwner])

  useEffect(() => {
    if (isOwner() && accounts.length > 0) {
      loadAccountInvitations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

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

  const loadAccountInvitations = async () => {
    try {
      const accountIds = accounts.map(acc => acc.id)
      if (accountIds.length === 0) return
      
      const invitations = await getAllPendingInvitationsForAccounts(accountIds)
      setAccountInvitations(invitations)
    } catch (err) {
      console.error('Error loading account invitations:', err)
    }
  }

  const createAccount = async () => {
    if (!newAccountName.trim() || !user) return
    if (!firstUserEmail.trim()) {
      setError('First user email is required')
      showError('Please provide an email address for the first user')
      return
    }

    try {
      setCreating(true)
      setError('')
      
      // Step 1: Create the account
      const accountId = await accountService.createAccount(
        newAccountName.trim(),
        user.id
      )

      // Step 2: Create invitation for the first user (always admin)
      const invitationLink = await createUserInvitation(
        firstUserEmail.trim(),
        UserRole.ADMIN,
        user.id,
        accountId
      )

      // Store the invitation link to display
      setLastInvitationLink(invitationLink)
      setLastInvitationEmail(firstUserEmail.trim())
      
      showSuccess(`Account "${newAccountName.trim()}" created successfully.`)
      setNewAccountName('')
      setFirstUserEmail('')
      await loadAccounts() // Refresh the list
      await loadAccountInvitations() // Refresh invitations
    } catch (err) {
      console.error('Error creating account:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account'
      setError(errorMessage)
      showError(errorMessage)
    } finally {
      setCreating(false)
    }
  }

  const copyInvitationLink = async () => {
    if (!lastInvitationLink) return
    try {
      await navigator.clipboard.writeText(lastInvitationLink)
      setCopiedLink(true)
      showSuccess('Invitation link copied to clipboard')
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      console.error('Error copying link:', err)
      showError('Failed to copy link')
    }
  }

  const copyAccountInvitationLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedTokens(new Set([...copiedTokens, token]))
      showSuccess('Invitation link copied to clipboard')
      setTimeout(() => {
        setCopiedTokens(new Set([...copiedTokens].filter(t => t !== token)))
      }, 2000)
    } catch (err) {
      console.error('Error copying link:', err)
      showError('Failed to copy link')
    }
  }

  const toggleAccountExpanded = (accountId: string) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(accountId)) {
        newSet.delete(accountId)
      } else {
        newSet.add(accountId)
      }
      return newSet
    })
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
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
                if (e.key === 'Enter' && newAccountName.trim() && firstUserEmail.trim() && !creating) {
                  createAccount()
                }
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">First User Email (Admin)</label>
            <input
              type="email"
              value={firstUserEmail}
              onChange={(e) => setFirstUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newAccountName.trim() && firstUserEmail.trim() && !creating) {
                  createAccount()
                }
              }}
            />
          </div>
          <Button
            onClick={createAccount}
            disabled={creating || !newAccountName.trim() || !firstUserEmail.trim()}
            className="w-full flex items-center justify-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>{creating ? 'Creating...' : 'Create Account'}</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Accounts are used to organize projects and data. An invitation link will be generated for the first user.
        </p>
      </div>

      {/* Invitation Link Display */}
      {lastInvitationLink && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 mb-1">Invitation Link Created</h3>
              <p className="text-xs text-blue-700 mb-3">
                Share this link with <span className="font-medium">{lastInvitationEmail || 'the invited user'}</span> to complete their account setup.
              </p>
              <div className="bg-white border border-blue-200 rounded-md p-3 mb-3">
                <div className="flex items-center space-x-2">
                  <code className="flex-1 text-xs text-gray-800 break-all font-mono">
                    {lastInvitationLink}
                  </code>
                  <button
                    onClick={copyInvitationLink}
                    className="flex-shrink-0 p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                    title="Copy invitation link"
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setLastInvitationLink(null)
                setLastInvitationEmail(null)
              }}
              className="flex-shrink-0 ml-2 p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
              accounts.map((account) => {
                const invitations = accountInvitations[account.id] || []
                const invitationCount = invitations.length
                const isExpanded = expandedAccounts.has(account.id)
                
                return (
                  <div key={account.id} className="bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center space-x-3 flex-1">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{account.name}</div>
                          <div className="text-xs text-gray-500">
                            Created {account.createdAt instanceof Date 
                              ? account.createdAt.toLocaleDateString()
                              : new Date(account.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {invitationCount > 0 && (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">
                              {invitationCount} {invitationCount === 1 ? 'invitation' : 'invitations'}
                            </span>
                          </div>
                        )}
                      </div>
                      {invitationCount > 0 && (
                        <button
                          onClick={() => toggleAccountExpanded(account.id)}
                          className="ml-2 p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title={isExpanded ? 'Collapse invitations' : 'View invitations'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                    
                    {/* Invitations List */}
                    {isExpanded && invitationCount > 0 && (
                      <div className="border-t border-gray-200 p-3 bg-white rounded-b-lg">
                        <h4 className="text-xs font-medium text-gray-700 mb-2">Pending Invitations</h4>
                        <div className="space-y-2">
                          {invitations.map((invitation) => {
                            const link = `${window.location.origin}/invite/${invitation.token}`
                            const isCopied = copiedTokens.has(invitation.token)
                            
                            return (
                              <div key={invitation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{invitation.email}</div>
                                  <div className="text-xs text-gray-500">
                                    Role: {invitation.role} • Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-gray-400 font-mono truncate mt-1">{link}</div>
                                </div>
                                <button
                                  onClick={() => copyAccountInvitationLink(invitation.token)}
                                  className="ml-3 flex-shrink-0 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Copy invitation link"
                                >
                                  {isCopied ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

