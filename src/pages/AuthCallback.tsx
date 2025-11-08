import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { checkInvitationByToken } from '../services/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Poll for session with bounded timeout (replaces fixed delay)
        // The auth listener in AuthContext will handle the actual auth state changes
        const maxAttempts = 20 // 20 attempts * 100ms = 2 seconds max
        let attempts = 0
        let session = null

        while (attempts < maxAttempts) {
          const { data: { session: currentSession }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('Auth callback error:', error)
            navigate('/')
            return
          }

          if (currentSession?.user) {
            session = currentSession
            break
          }

          attempts++
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (session?.user) {
          // Check if there's a pending invitation token
          const pendingToken = localStorage.getItem('pendingInvitationToken')
          if (pendingToken) {
            try {
              const invitation = await checkInvitationByToken(pendingToken)
              if (invitation) {
                // Store invitation info for use in createOrUpdateUserDocument
                // Don't clear it here - let createOrUpdateUserDocument consume it first
                localStorage.setItem('pendingInvitationData', JSON.stringify({
                  invitationId: invitation.invitationId,
                  accountId: invitation.accountId,
                  role: invitation.role
                }))
              }
            } catch (err) {
              console.error('Error checking invitation token:', err)
            }
            // Clear the token (but keep pendingInvitationData for user doc creation)
            localStorage.removeItem('pendingInvitationToken')
          }

          // Don't clear pendingInvitationData here - it will be cleared by createOrUpdateUserDocument
          // after it consumes it during the SIGNED_IN event handling
          
          navigate('/')
        } else {
          navigate('/')
        }
      } catch (error) {
        console.error('Error handling auth callback:', error)
        navigate('/')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}

