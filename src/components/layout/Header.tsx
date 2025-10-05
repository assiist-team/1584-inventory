import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { LogOut, Settings, Package, FolderOpen } from 'lucide-react'

export default function Header() {
  const { user, signOut, loading } = useAuth()
  const location = useLocation()

  const isProjectsActive = location.pathname.startsWith('/projects') || location.pathname.startsWith('/project') || location.pathname === '/'
  const isBusinessInventoryActive = location.pathname.startsWith('/business-inventory')

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center flex-wrap gap-2">
          {/* Left side */}
          <div className="flex items-center gap-6">
            {/* Logo/Brand */}
            <Link to="/" className="text-xl font-bold text-gray-900">
              1584 Design
            </Link>

            {/* Navigation Tabs */}
            <nav className="flex space-x-1">
              <Link
                to="/"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isProjectsActive
                    ? 'bg-primary-100 text-primary-700 border-b-2 border-primary-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Projects
              </Link>
              <Link
                to="/business-inventory"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isBusinessInventoryActive
                    ? 'bg-primary-100 text-primary-700 border-b-2 border-primary-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Package className="h-4 w-4 mr-2" />
                Inventory
              </Link>
            </nav>
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
