import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { createOrUpdateUserDocument, checkInvitationByToken } from '../services/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          navigate('/login')
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

          // Create or update user document after successful OAuth redirect
          await createOrUpdateUserDocument(session.user)
          
          // Clear any stored invitation data
          localStorage.removeItem('pendingInvitationData')
          
          navigate('/')
        } else {
          navigate('/login')
        }
      } catch (error) {
        console.error('Error handling auth callback:', error)
        navigate('/login')
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

