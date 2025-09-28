import { Transaction } from '@/types'

interface BudgetProgressProps {
  budget?: number
  designFee?: number
  transactions: Transaction[]
}

interface CompactBudgetProgressProps {
  budget?: number
  designFee?: number
  transactions: Transaction[]
}

export default function BudgetProgress({ budget, designFee, transactions }: BudgetProgressProps) {
  // Calculate total spent (purchases + design fee, excluding returns)
  const calculateSpent = (): number => {
    if (!budget && budget !== 0) return 0

    // Sum all purchases (exclude returns)
    const purchases = transactions
      .filter(transaction => transaction.transaction_type === 'Purchase')
      .reduce((total, transaction) => total + parseFloat(transaction.amount || '0'), 0)

    // Add design fee if it exists
    const totalDesignFee = designFee || 0

    return purchases + totalDesignFee
  }

  // Don't show if no budget is set
  if (budget === null || budget === undefined) {
    return null
  }

  const spent = calculateSpent()
  const percentage = budget > 0 ? (spent / budget) * 100 : 0

  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getPercentageColor = () => {
    if (percentage >= 100) return 'text-red-600'
    if (percentage >= 80) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h3 className="text-lg font-medium text-gray-900">Budget Progress</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            ${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-gray-500">of ${budget.toLocaleString('en-US')} budget</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>

        {/* Percentage */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Progress</span>
          <span className={`font-semibold ${getPercentageColor()}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>

        {/* Budget Status Message */}
        <div className="mt-3 text-sm">
          {percentage >= 100 ? (
            <div className="flex items-center text-red-600">
              <span className="mr-2">⚠️</span>
              Budget exceeded by ${(spent - budget).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          ) : percentage >= 80 ? (
            <div className="flex items-center text-yellow-600">
              <span className="mr-2">⚠️</span>
              {((100 - percentage)).toFixed(1)}% of budget remaining
            </div>
          ) : (
            <div className="flex items-center text-green-600">
              <span className="mr-2">✅</span>
              ${(budget - spent).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining
            </div>
          )}
        </div>

        {/* Breakdown */}
        {(transactions.length > 0 || designFee) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <div className="flex justify-between mb-1">
                <span>Purchases:</span>
                <span>${transactions
                  .filter(t => t.transaction_type === 'Purchase')
                  .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {designFee && designFee > 0 && (
                <div className="flex justify-between mb-1">
                  <span>Design Fee:</span>
                  <span>${designFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t border-gray-300">
                <span>Total Spent:</span>
                <span>${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CompactBudgetProgress({ budget, designFee, transactions }: CompactBudgetProgressProps) {
  // Calculate total spent (purchases + design fee, excluding returns)
  const calculateSpent = (): number => {
    if (!budget && budget !== 0) return 0

    // Sum all purchases (exclude returns)
    const purchases = transactions
      .filter(transaction => transaction.transaction_type === 'Purchase')
      .reduce((total, transaction) => total + parseFloat(transaction.amount || '0'), 0)

    // Add design fee if it exists
    const totalDesignFee = designFee || 0

    return purchases + totalDesignFee
  }

  // Don't show if no budget is set
  if (budget === null || budget === undefined) {
    return (
      <div className="text-center py-2">
        <div className="text-xs text-gray-500">No budget set</div>
      </div>
    )
  }

  const spent = calculateSpent()
  const percentage = budget > 0 ? (spent / budget) * 100 : 0

  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getPercentageColor = () => {
    if (percentage >= 100) return 'text-red-600'
    if (percentage >= 80) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      {/* Header with amount and percentage */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-medium text-gray-700">Budget</div>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">
            ${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs ${getPercentageColor()}`}>
            {percentage.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Compact Progress Bar */}
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-1 flex justify-between items-center text-xs">
        <span className="text-gray-500">${budget.toLocaleString('en-US')}</span>
        <div className="flex items-center">
          {percentage >= 100 ? (
            <span className="text-red-600">⚠️ Over budget</span>
          ) : percentage >= 80 ? (
            <span className="text-yellow-600">⚠️ {((100 - percentage)).toFixed(0)}% left</span>
          ) : (
            <span className="text-green-600">✅ ${((budget - spent)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} left</span>
          )}
        </div>
      </div>
    </div>
  )
}
