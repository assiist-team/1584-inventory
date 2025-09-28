import { Link } from 'react-router-dom'

export default function Header() {
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

          {/* Right side - empty for now */}
          <div className="flex items-center space-x-4">
          </div>
        </div>
      </div>
    </header>
  )
}
