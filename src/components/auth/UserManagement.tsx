import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useAccount } from '../../contexts/AccountContext'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { supabase } from '../../services/supabase'
import { createUserInvitation, getPendingInvitations } from '../../services/supabase'
import { User, UserRole } from '../../types'
import { Mail, Shield, Users, Crown, Copy, Check } from 'lucide-react'
import { convertTimestamps } from '../../services/databaseService'

interface UserManagementProps {
  className?: string
}

export default function UserManagement({ className }: UserManagementProps) {
  const { user: currentUser, isOwner, loading: authLoading } = useAuth()
  const { currentAccountId, isAdmin, loading: accountLoading } = useAccount()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.USER)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [pendingInvitations, setPendingInvitations] = useState<Array<{
    id: string;
    email: string;
    role: 'admin' | 'user';
    token: string;
    createdAt: string;
    expiresAt: string;
  }>>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Check if current user can manage users (admin or owner)
  const canManageUsers = isAdmin || isOwner()

  useEffect(() => {
    if (authLoading || accountLoading) {
      setLoading(true)
      return
    }
    if (canManageUsers && currentAccountId) {
      loadUsers()
      loadPendingInvitations()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers, currentAccountId, authLoading, accountLoading])

  const loadPendingInvitations = async () => {
    if (!currentAccountId) return
    try {
      const invitations = await getPendingInvitations(currentAccountId)
      setPendingInvitations(invitations)
    } catch (err) {
      console.error('Error loading pending invitations:', err)
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get account memberships for each user to determine their account role
      const usersData = await Promise.all(
        (data || []).map(async (userData) => {
          const converted = convertTimestamps(userData)
          
          // Get account membership to determine role
          let accountRole: UserRole | null = null
          if (currentAccountId) {
            const { data: membership } = await supabase
              .from('account_members')
              .select('role')
              .eq('user_id', converted.id)
              .eq('account_id', currentAccountId)
              .maybeSingle()
            
            if (membership) {
              accountRole = membership.role === 'admin' ? UserRole.ADMIN : UserRole.USER
            }
          }

          // System-level role takes precedence
          // For display: OWNER > account role > USER (default)
          const displayRole = converted.role === 'owner' 
            ? UserRole.OWNER 
            : accountRole || UserRole.USER

          return {
            id: converted.id,
            email: converted.email,
            fullName: converted.full_name,
            role: displayRole,
            accountId: currentAccountId || '',
            createdAt: converted.created_at ? new Date(converted.created_at) : new Date(),
            lastLogin: converted.last_login ? new Date(converted.last_login) : new Date()
          } as User
        })
      )

      setUsers(usersData)
    } catch (err) {
      console.error('Error loading users:', err)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      if (!currentAccountId) {
        setError('Account ID is required')
        return
      }

      // Convert UserRole enum to account role ('admin' or 'user')
      // Note: OWNER role is system-level and cannot be assigned via account membership
      const accountRole = newRole === UserRole.ADMIN ? 'admin' : 'user'

      // Update account membership role
      const { error: membershipError } = await supabase
        .from('account_members')
        .update({ role: accountRole })
        .eq('user_id', userId)
        .eq('account_id', currentAccountId)

      if (membershipError) {
        // If membership doesn't exist, create it
        if (membershipError.code === 'PGRST116' || membershipError.message.includes('No rows')) {
          const { error: insertError } = await supabase
            .from('account_members')
            .insert({
              user_id: userId,
              account_id: currentAccountId,
              role: accountRole,
              joined_at: new Date().toISOString()
            })
          
          if (insertError) throw insertError
        } else {
          throw membershipError
        }
      }

      await loadUsers() // Refresh the list
    } catch (err) {
      console.error('Error updating user role:', err)
      setError('Failed to update user role')
    }
  }

  const inviteUser = async () => {
    if (!inviteEmail.trim()) return

    try {
      setInviting(true)
      setError('')

      // Create invitation in Supabase
      if (!currentAccountId) {
        setError('Account ID is required')
        return
      }
      if (!currentUser?.id) {
        setError('User ID is required')
        return
      }
      
      const invitationLink = await createUserInvitation(
        inviteEmail.trim(), 
        inviteRole, 
        currentUser.id, 
        currentAccountId
      )

      // Reload invitations to show the new one
      await loadPendingInvitations()

      // Copy link to clipboard
      await navigator.clipboard.writeText(invitationLink)
      setCopiedToken(invitationLink)
      setTimeout(() => setCopiedToken(null), 2000)

      setInviteEmail('')
      setInviteRole(UserRole.USER)
    } catch (err) {
      console.error('Error inviting user:', err)
      setError('Failed to create invitation')
    } finally {
      setInviting(false)
    }
  }

  const copyInvitationLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(link)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case UserRole.OWNER:
        return <Crown className="h-4 w-4 text-yellow-500" />
      case UserRole.ADMIN:
        return <Shield className="h-4 w-4 text-blue-500" />
      case UserRole.USER:
        return <Users className="h-4 w-4 text-gray-500" />
      default:
        return <Users className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.OWNER:
        return 'bg-yellow-100 text-yellow-800'
      case UserRole.ADMIN:
        return 'bg-blue-100 text-blue-800'
      case UserRole.USER:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!canManageUsers) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have permission to manage users.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-gray-900">
            User Management
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Invite team members and manage user roles
          </p>
        </div>
      </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* Invite User Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Invite Team Member</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            <Select
              label="Assign Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              <option value={UserRole.USER}>User</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </Select>
            <Button
              onClick={inviteUser}
              disabled={inviting || !inviteEmail.trim()}
              className="w-full flex items-center justify-center space-x-2"
            >
              <Mail className="h-4 w-4" />
              <span>{inviting ? 'Creating...' : 'Create Invitation Link'}</span>
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            An invitation link will be generated and copied to your clipboard. Share it with the user to invite them.
          </p>
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Pending Invitations</h3>
            <div className="space-y-2">
              {pendingInvitations.map((invitation) => {
                const link = `${window.location.origin}/invite/${invitation.token}`
                const isCopied = copiedToken === invitation.token
                return (
                  <div key={invitation.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{invitation.email}</div>
                      <div className="text-xs text-gray-500">
                        Role: {invitation.role} • Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400 font-mono truncate mt-1">{link}</div>
                    </div>
                    <button
                      onClick={() => copyInvitationLink(invitation.token)}
                      className="ml-3 flex-shrink-0 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
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

        {/* Users List */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Team Members</h3>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getRoleIcon(user.role)}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                    {user.id !== currentUser?.id && user.role !== UserRole.OWNER && (
                      <Select
                        size="sm"
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                      >
                        <option value={UserRole.USER}>User</option>
                        <option value={UserRole.ADMIN}>Admin</option>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  )
}
