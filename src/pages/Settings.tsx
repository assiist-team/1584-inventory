import { User, Database, Settings as SettingsIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import UserManagement from '../components/auth/UserManagement'
import MigrationRunner from '../components/MigrationRunner'
import TaxPresetsManager from '../components/TaxPresetsManager'
import { UserRole } from '../types'

export default function Settings() {
  const { user, hasRole } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Section */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Profile
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your account settings and preferences
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900">Profile Information</h4>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Display Name</label>
                    <div className="mt-1 p-2 bg-gray-50 rounded-md text-sm text-gray-900">{user?.displayName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <div className="mt-1 p-2 bg-gray-50 rounded-md text-sm text-gray-900">{user?.email}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <div className="mt-1 p-2 bg-gray-50 rounded-md text-sm text-gray-900 capitalize">
                      {user?.role}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Contact an administrator to change your role.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Management Section - Only for admins */}
        {hasRole(UserRole.ADMIN) && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <UserManagement />
          </div>
        )}

        {/* Migration Section - Only for admins */}
        {hasRole(UserRole.ADMIN) && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <Database className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    Data Migration
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Migrate items from project subcollections to unified collection
                  </p>
                </div>
              </div>
              <MigrationRunner />
            </div>
          </div>
        )}

        {/* Tax Presets Management Section - Only for admins */}
        {hasRole(UserRole.ADMIN) && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <SettingsIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    Tax Rate Presets
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage tax rate presets available when creating transactions
                  </p>
                </div>
              </div>
              <TaxPresetsManager />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
