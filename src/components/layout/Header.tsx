import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { LogOut, Settings } from 'lucide-react'

export default function Header() {
  const { user, signOut, loading } = useAuth()

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center flex-wrap gap-2">
          {/* Left side */}
          <div className="flex items-center">
            {/* Logo/Brand */}
            <Link to="/" className="text-xl font-bold text-gray-900">
              1584
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center">
            {user && (
              <div className="flex items-center space-x-2">
                <Link
                  to="/settings"
                  className="flex items-center text-sm text-gray-700 hover:text-gray-900"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={signOut}
                  disabled={loading}
                  className="flex items-center"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
