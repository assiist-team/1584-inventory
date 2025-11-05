import { useState } from 'react'
import { User, Settings as SettingsIcon, Building2, Upload } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useBusinessProfile } from '../contexts/BusinessProfileContext'
import { businessProfileService } from '../services/businessProfileService'
import { ImageUploadService } from '../services/imageService'
import UserManagement from '../components/auth/UserManagement'
import TaxPresetsManager from '../components/TaxPresetsManager'
import { Button } from '../components/ui/Button'
import { UserRole } from '../types'

export default function Settings() {
  const { user, hasRole } = useAuth()
  const { currentAccountId, isAdmin } = useAccount()
  const { businessProfile, businessName, businessLogoUrl, refreshProfile } = useBusinessProfile()
  const [businessNameInput, setBusinessNameInput] = useState(businessName)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(businessLogoUrl || null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!ImageUploadService.validateImageFile(file)) {
        setProfileError('Invalid image file. Please upload a valid image (JPEG, PNG, GIF, WebP) under 10MB.')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setProfileError(null)
    }
  }

  const handleSaveProfile = async () => {
    if (!currentAccountId || !user) return

    setIsSavingProfile(true)
    setProfileError(null)
    setProfileSuccess(false)

    try {
      let logoUrl = businessLogoUrl || null

      // Upload logo if a new file was selected
      if (logoFile) {
        const uploadResult = await ImageUploadService.uploadBusinessLogo(currentAccountId, logoFile)
        logoUrl = uploadResult.url
      }

      // Update business profile
      await businessProfileService.updateBusinessProfile(
        currentAccountId,
        businessNameInput.trim(),
        logoUrl,
        user.id
      )

      // Refresh profile to get updated data
      await refreshProfile()
      setProfileSuccess(true)
      setLogoFile(null)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (error: any) {
      console.error('Error saving business profile:', error)
      setProfileError(error.message || 'Failed to save business profile. Please try again.')
    } finally {
      setIsSavingProfile(false)
    }
  }

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

        {/* Business Profile Section - Only for admins */}
        {isAdmin && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <Building2 className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    Business Profile
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage your business name and logo for invoices and branding
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Business Name */}
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={businessNameInput}
                    onChange={(e) => setBusinessNameInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter business name"
                  />
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Logo
                  </label>
                  <div className="flex items-start space-x-4">
                    {logoPreview && (
                      <div className="flex-shrink-0">
                        <img
                          src={logoPreview}
                          alt="Business logo preview"
                          className="h-24 w-24 object-contain border border-gray-300 rounded"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                        <div className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                          <Upload className="h-4 w-4 mr-2" />
                          {logoFile ? 'Change Logo' : logoPreview ? 'Change Logo' : 'Upload Logo'}
                        </div>
                      </label>
                      <p className="mt-2 text-xs text-gray-500">
                        Recommended: Square image, at least 200x200px. Max size: 10MB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error/Success Messages */}
                {profileError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{profileError}</p>
                  </div>
                )}
                {profileSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">Business profile saved successfully!</p>
                  </div>
                )}

                {/* Save Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile || !businessNameInput.trim()}
                    className="w-full sm:w-auto"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Business Profile'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
