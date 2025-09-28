import { User, Bell, Shield, Palette } from 'lucide-react'

export default function Settings() {
  const settingsSections = [
    {
      name: 'Profile',
      description: 'Manage your account settings and preferences',
      icon: User,
      href: '#profile'
    },
    {
      name: 'Notifications',
      description: 'Configure how you receive notifications',
      icon: Bell,
      href: '#notifications'
    },
    {
      name: 'Security',
      description: 'Manage security settings and privacy',
      icon: Shield,
      href: '#security'
    },
    {
      name: 'Appearance',
      description: 'Customize the look and feel of your dashboard',
      icon: Palette,
      href: '#appearance'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {settingsSections.map((section) => (
          <div key={section.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <section.icon className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    {section.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {section.description}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <button className="text-sm font-medium text-primary-600 hover:text-primary-500">
                  Configure
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Settings will be implemented in the next phase
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>
              The settings interface will be fully functional once the core inventory
              management features are complete. This will include user preferences,
              notification settings, security options, and appearance customization.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
