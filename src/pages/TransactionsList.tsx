import { Plus, Search, Filter } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { Transaction } from '@/types'
import { transactionService } from '@/services/inventoryService'
import { formatDate, formatCurrency } from '@/utils/dateUtils'

// Remove any unwanted icons from transaction type badges
const removeUnwantedIcons = () => {
  const badges = document.querySelectorAll('.no-icon')
  badges.forEach(badge => {
    // Remove any child elements that aren't text nodes
    const children = Array.from(badge.childNodes)
    children.forEach(child => {
      if (child.nodeType !== Node.TEXT_NODE) {
        badge.removeChild(child)
      }
    })
  })
}

interface TransactionsListProps {
  projectId?: string
}

export default function TransactionsList({ projectId: propProjectId }: TransactionsListProps) {
  const { id: routeProjectId } = useParams<{ id: string }>()
  // Use prop if provided, otherwise fall back to route param
  const projectId = propProjectId || routeProjectId
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'we-owe' | 'client-owes'>('all')

  useEffect(() => {
    const loadTransactions = async () => {
      if (!projectId) {
        setIsLoading(false)
        return
      }

      try {
        const data = await transactionService.getTransactions(projectId)
        setTransactions(data)
      } catch (error) {
        console.error('Error loading transactions:', error)
        setTransactions([])
      } finally {
        setIsLoading(false)
      }
    }

    loadTransactions()
  }, [projectId])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!projectId) return

    const unsubscribe = transactionService.subscribeToTransactions(projectId, (updatedTransactions) => {
      setTransactions(updatedTransactions)
    })

    return unsubscribe
  }, [projectId])

  // Filter transactions based on search and filter mode
  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    // Apply reimbursement type filter based on filter mode
    if (filterMode !== 'all') {
      if (filterMode === 'we-owe') {
        filtered = filtered.filter(t => t.reimbursement_type === 'We Owe')
      } else if (filterMode === 'client-owes') {
        filtered = filtered.filter(t => t.reimbursement_type === 'Client Owes')
      }
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.source?.toLowerCase().includes(query) ||
        t.transaction_type?.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [transactions, filterMode, searchQuery])

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target) return

      const target = event.target as Element
      if (!target.closest('.filter-menu') && !target.closest('.filter-button')) {
        setShowFilterMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Clean up any unwanted icons from transaction type badges
  useEffect(() => {
    removeUnwantedIcons()
    // Also run after a short delay to catch any dynamically added icons
    const timer = setTimeout(removeUnwantedIcons, 100)
    const timer2 = setTimeout(removeUnwantedIcons, 500)
    return () => {
      clearTimeout(timer)
      clearTimeout(timer2)
    }
  }, [transactions])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header - Add Transaction button */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
        <Link
          to={`/project/${projectId}/transaction/add`}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Link>
      </div>

      {/* Search and Controls - Sticky Container */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 pb-0 mb-2">
        <div className="space-y-0">
          {/* Search Bar */}
          <div className="relative pt-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
              placeholder="Search transactions by source, type, or notes..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Controls */}
          <div className="flex items-center justify-end gap-4 p-3 rounded-lg">
            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`filter-button inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md transition-colors duration-200 ${
                  filterMode === 'all'
                    ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                    : 'border-primary-500 text-primary-600 bg-primary-50 hover:bg-primary-100'
                }`}
                title="Filter transactions"
              >
                <Filter className="h-4 w-4" />
              </button>

              {/* Filter Dropdown Menu */}
              {showFilterMenu && (
                <div className="filter-menu absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setFilterMode('all')
                        setShowFilterMenu(false)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        filterMode === 'all' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                      }`}
                    >
                      All Transactions
                    </button>
                    <button
                      onClick={() => {
                        setFilterMode('we-owe')
                        setShowFilterMenu(false)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        filterMode === 'we-owe' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                      }`}
                    >
                      We Owe
                    </button>
                    <button
                      onClick={() => {
                        setFilterMode('client-owes')
                        setShowFilterMenu(false)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        filterMode === 'client-owes' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                      }`}
                    >
                      Client Owes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="mx-auto h-16 w-16 text-gray-400 -mb-1">🧾</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No transactions found
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchQuery || filterMode !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No transactions found.'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => (
              <li key={transaction.transaction_id} className="relative">
                <Link
                  to={`/project/${projectId}/transaction/${transaction.transaction_id}`}
                  className="block bg-gray-50 transition-colors duration-200 hover:bg-gray-100"
                >
                  <div className="px-4 py-4 sm:px-6">
                    {/* Top row: Header with source and type */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <h3 className="text-base font-medium text-gray-900">
                          {transaction.source}
                        </h3>
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        {transaction.budget_category && (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            transaction.budget_category === 'Design Fee'
                              ? 'bg-amber-100 text-amber-800'
                              : transaction.budget_category === 'Furnishings'
                              ? 'bg-yellow-100 text-yellow-800'
                              : transaction.budget_category === 'Property Management'
                              ? 'bg-orange-100 text-orange-800'
                              : transaction.budget_category === 'Kitchen'
                              ? 'bg-amber-200 text-amber-900'
                              : transaction.budget_category === 'Install'
                              ? 'bg-yellow-200 text-yellow-900'
                              : transaction.budget_category === 'Storage & Receiving'
                              ? 'bg-orange-200 text-orange-900'
                              : transaction.budget_category === 'Fuel'
                              ? 'bg-amber-300 text-amber-900'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {transaction.budget_category}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium no-icon ${
                          transaction.transaction_type === 'Purchase'
                            ? 'bg-green-100 text-green-800'
                            : transaction.transaction_type === 'Return'
                            ? 'bg-red-100 text-red-800'
                            : transaction.transaction_type === 'To Inventory'
                            ? 'bg-primary-100 text-primary-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.transaction_type}
                        </span>

                      </div>
                    </div>

                    {/* Bottom row: Details */}
                    <div className="space-y-2">
                      {/* Details row - Price, payment method, date */}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="font-medium text-gray-700">{formatCurrency(transaction.amount)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="font-medium text-gray-700 capitalize">{transaction.payment_method}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="font-medium text-gray-700">{formatDate(transaction.transaction_date)}</span>
                      </div>

                      {/* Notes */}
                      {transaction.notes && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {transaction.notes}
                        </p>
                      )}
                    </div>

                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
