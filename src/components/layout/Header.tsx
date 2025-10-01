import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { LogOut, User, Settings } from 'lucide-react'

export default function Header() {
  const { user, signOut, loading } = useAuth()

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Left side */}
          <div className="flex items-center">
            {/* Logo/Brand */}
            <Link to="/" className="text-xl font-bold text-gray-900">
              1584 Design Inventory & Transactions
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-3">
                <Link
                  to="/settings"
                  className="flex items-center space-x-1 text-sm text-gray-700 hover:text-gray-900"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{user.displayName}</span>
                  <span className="text-gray-500">({user.email})</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={signOut}
                  disabled={loading}
                  className="flex items-center space-x-1"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
