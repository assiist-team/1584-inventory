import { useState } from 'react'
import { Transaction, ProjectBudgetCategories, BudgetCategory } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface BudgetProgressProps {
  budget?: number
  designFee?: number
  budgetCategories?: ProjectBudgetCategories
  transactions: Transaction[]
}

interface CategoryBudgetData {
  category: BudgetCategory
  budget: number
  spent: number
  percentage: number
}

interface CompactBudgetProgressProps {
  budget?: number
  designFee?: number
  budgetCategories?: ProjectBudgetCategories
  transactions: Transaction[]
}

export default function BudgetProgress({ budget, designFee, budgetCategories, transactions }: BudgetProgressProps) {
  const [showAllCategories, setShowAllCategories] = useState(false)

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

  // Calculate spending for each budget category
  const calculateCategoryBudgetData = (): CategoryBudgetData[] => {
    if (!budgetCategories) return []

    const categoryData: CategoryBudgetData[] = []

    // Define the categories to track in desired order
    const categories = [
      { key: 'furnishings' as keyof ProjectBudgetCategories, label: BudgetCategory.FURNISHINGS },
      { key: 'install' as keyof ProjectBudgetCategories, label: BudgetCategory.INSTALL },
      { key: 'fuel' as keyof ProjectBudgetCategories, label: BudgetCategory.FUEL },
      { key: 'storageReceiving' as keyof ProjectBudgetCategories, label: BudgetCategory.STORAGE_RECEIVING },
      { key: 'kitchen' as keyof ProjectBudgetCategories, label: BudgetCategory.KITCHEN },
      { key: 'propertyManagement' as keyof ProjectBudgetCategories, label: BudgetCategory.PROPERTY_MANAGEMENT },
      { key: 'designFee' as keyof ProjectBudgetCategories, label: BudgetCategory.DESIGN_FEE },
    ]

    categories.forEach(({ key, label }) => {
      const categoryBudget = budgetCategories[key] || 0
      // Show design fee progress bar even if no transactions yet
      const shouldShowCategory = label === BudgetCategory.DESIGN_FEE ?
        (designFee !== null && designFee !== undefined && designFee > 0) :
        categoryBudget > 0

      if (shouldShowCategory) {
        // Special handling for Design Fee - track received vs remaining to receive
        if (label === BudgetCategory.DESIGN_FEE) {
          const designFeeReceived = transactions
            .filter(transaction =>
              transaction.transaction_type === 'Purchase' &&
              transaction.budget_category === BudgetCategory.DESIGN_FEE
            )
            .reduce((total, transaction) => total + parseFloat(transaction.amount || '0'), 0)

          const percentage = designFee && designFee > 0 ? (designFeeReceived / designFee) * 100 : 0

          categoryData.push({
            category: label,
            budget: designFee || 0, // Use designFee instead of budgetCategories[key]
            spent: Math.round(designFeeReceived), // For design fee, "spent" represents "received"
            percentage: Math.min(percentage, 100) // Cap at 100%
          })
        } else {
          // Regular categories - track spent vs budget
          const categorySpent = transactions
            .filter(transaction =>
              transaction.transaction_type === 'Purchase' &&
              transaction.budget_category === label
            )
            .reduce((total, transaction) => total + parseFloat(transaction.amount || '0'), 0)

          const percentage = categoryBudget > 0 ? (categorySpent / categoryBudget) * 100 : 0

          categoryData.push({
            category: label,
            budget: categoryBudget,
            spent: Math.round(categorySpent),
            percentage: Math.min(percentage, 100) // Cap at 100%
          })
        }
      }
    })

    return categoryData
  }

  const spent = Math.round(calculateSpent())
  const percentage = budget && budget > 0 ? (spent / budget) * 100 : 0
  const allCategoryData = calculateCategoryBudgetData()

  // Filter categories based on toggle state - show only furnishings by default, overall budget only when expanded
  const categoryData = allCategoryData.filter(category =>
    category.category === BudgetCategory.FURNISHINGS || showAllCategories
  )

  // Add overall budget as a category if it exists and should be shown
  const shouldShowOverallBudget = budget !== null && budget !== undefined && budget > 0 && showAllCategories
  const overallBudgetCategory = shouldShowOverallBudget ? {
    category: 'Overall Budget' as BudgetCategory,
    budget: budget,
    spent: spent,
    percentage: percentage
  } : null

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // Color logic for remaining amounts (green when plenty left, yellow when warning, red when over)
  const getRemainingColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600' // Over budget = red
    if (percentage >= 80) return 'text-yellow-600' // Warning level = yellow
    return 'text-green-600' // Plenty left = green
  }

  // Reversed color logic for design fee (green when received, red when not received)
  const getDesignFeeProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500' // Fully received = good (green)
    if (percentage >= 80) return 'bg-yellow-500' // Mostly received = warning (yellow)
    return 'bg-red-500' // Little/nothing received = bad (red)
  }

  // Reversed color logic for design fee remaining amounts
  const getDesignFeeRemainingColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600' // Fully received = good (green)
    if (percentage >= 80) return 'text-yellow-600' // Mostly received = warning (yellow)
    return 'text-red-600' // Little/nothing received = bad (red)
  }

  // Format category names to include "Budget" suffix
  const formatCategoryName = (categoryName: string) => {
    // Don't add "Budget" to Design Fee or Overall Budget as they're already clear
    if (categoryName === BudgetCategory.DESIGN_FEE || categoryName === 'Overall Budget') {
      return categoryName
    }
    return `${categoryName} Budget`
  }

  // If no budget or categories are set, don't show anything
  if ((budget === null || budget === undefined) && (!budgetCategories || Object.values(budgetCategories).every(v => v === 0))) {
    return null
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">

      {/* Category Budget Progress */}
      {categoryData.length > 0 && (
        <div>

          <div className="space-y-4">
            {[...categoryData, ...(overallBudgetCategory ? [overallBudgetCategory] : [])].map((category) => {
              const isDesignFee = category.category === BudgetCategory.DESIGN_FEE
              return (
                <div key={category.category}>
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-medium text-gray-900">{formatCategoryName(category.category)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        ${Math.round(category.spent).toLocaleString('en-US')} {isDesignFee ? 'received' : 'spent'}
                      </span>
                      <span className={`text-sm ${isDesignFee ? getDesignFeeRemainingColor(category.percentage) : getRemainingColor(category.percentage)}`}>
                        <span className="font-bold">${Math.round((category.budget || 0) - category.spent).toLocaleString('en-US')}</span> remaining
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative">
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isDesignFee ? getDesignFeeProgressColor(category.percentage) : getProgressColor(category.percentage)
                        }`}
                        style={{ width: `${Math.min(category.percentage, 100)}%` }}
                      />
                    </div>

                  </div>
                </div>
              )
            })}
          </div>

          {/* Show All Categories Toggle - positioned at bottom */}
          {(allCategoryData.some(cat => cat.category !== BudgetCategory.FURNISHINGS) || (budget !== null && budget !== undefined && budget > 0)) && (
            <div className="mt-4">
              <button
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {showAllCategories ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show All Budget Categories
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Show message if no budgets are configured */}
      {!budget && !designFee && (!budgetCategories || Object.values(budgetCategories).every(v => v === 0)) && (
        <div className="text-center py-4 text-gray-500">
          <p>No budgets configured for this project.</p>
        </div>
      )}
    </div>
  )
}

export function CompactBudgetProgress({ budget, designFee, budgetCategories, transactions }: CompactBudgetProgressProps) {
  // Calculate total spent (purchases + design fee, excluding returns)
  const calculateSpent = (targetBudget?: number): number => {
    if (targetBudget === null || targetBudget === undefined) return 0

    // Sum all purchases (exclude returns)
    const purchases = transactions
      .filter(transaction => transaction.transaction_type === 'Purchase')
      .reduce((total, transaction) => total + parseFloat(transaction.amount || '0'), 0)

    // Add design fee if it exists
    const totalDesignFee = designFee || 0

    return purchases + totalDesignFee
  }

  // Determine which budget to show - prioritize furnishings budget for preview cards
  const displayBudget = budgetCategories?.furnishings || budget
  const displayBudgetType = budgetCategories?.furnishings ? 'furnishings' : 'overall'

  // Don't show if no budget is set
  if (displayBudget === null || displayBudget === undefined || displayBudget === 0) {
    return (
      <div className="text-center py-2">
        <div className="text-xs text-gray-500">No budget set</div>
      </div>
    )
  }

  const spent = calculateSpent(displayBudget)
  const percentage = displayBudget > 0 ? (spent / displayBudget) * 100 : 0

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
        <div className="text-sm font-medium text-gray-700">
          {displayBudgetType === 'furnishings' ? 'Furnishings' : 'Budget'}
        </div>
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
        <span className="text-gray-500">${displayBudget.toLocaleString('en-US')}</span>
        <div className="flex items-center">
          {percentage >= 100 ? (
            <span className="text-red-600">⚠️ Over budget</span>
          ) : percentage >= 80 ? (
            <span className="text-yellow-600">⚠️ {((100 - percentage)).toFixed(0)}% left</span>
          ) : (
            <span className="text-green-600">✅ ${((displayBudget - spent)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} left</span>
          )}
        </div>
      </div>
    </div>
  )
}
