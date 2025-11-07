import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { checkInvitationByToken } from '../services/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase automatically handles OAuth callback when detectSessionInUrl is true
        // Just wait a moment for it to process, then check the session
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          navigate('/')
          return
        }

        if (session?.user) {
          // Check if there's a pending invitation token
          const pendingToken = localStorage.getItem('pendingInvitationToken')
          if (pendingToken) {
            try {
              const invitation = await checkInvitationByToken(pendingToken)
              if (invitation) {
                // Store invitation info for use in createOrUpdateUserDocument
                localStorage.setItem('pendingInvitationData', JSON.stringify({
                  invitationId: invitation.invitationId,
                  accountId: invitation.accountId,
                  role: invitation.role
                }))
              }
            } catch (err) {
              console.error('Error checking invitation token:', err)
            }
            // Clear the token
            localStorage.removeItem('pendingInvitationToken')
          }

          // Clear any stored invitation data
          localStorage.removeItem('pendingInvitationData')
          
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

