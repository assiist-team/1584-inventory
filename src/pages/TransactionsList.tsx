import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <Link
          to={`/project/${projectId}/transaction/add`}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Link>
      </div>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="mx-auto h-16 w-16 text-gray-400 -mb-1">🧾</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No transactions yet
          </h3>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <li key={transaction.transaction_id} className="relative">
                <Link
                  to={`/project/${projectId}/transaction/${transaction.transaction_id}`}
                  className="block bg-gray-50 transition-colors duration-200 hover:bg-gray-100 active:bg-gray-200"
                >
                  <div className="px-4 py-4 sm:px-6">
                    {/* Top row: Header with source and type */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="text-base font-medium text-gray-900">
                          {transaction.source}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium no-icon ${
                          transaction.transaction_type === 'Purchase'
                            ? 'bg-green-100 text-green-800'
                            : transaction.transaction_type === 'Return'
                            ? 'bg-blue-100 text-blue-800'
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
