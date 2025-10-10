import { useState, useEffect } from 'react'
import { Transaction, ProjectBudgetCategories, BudgetCategory } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface BudgetProgressProps {
  budget?: number
  designFee?: number
  budgetCategories?: ProjectBudgetCategories
  transactions: Transaction[]
  previewMode?: boolean // If true, only show primary budget (furnishings or overall) without toggle
}

interface CategoryBudgetData {
  category: BudgetCategory
  budget: number
  spent: number
  percentage: number
}


export default function BudgetProgress({ budget, designFee, budgetCategories, transactions, previewMode = false }: BudgetProgressProps) {
  const [showAllCategories, setShowAllCategories] = useState(false)

  // Calculate total spent for overall budget (exclude Design Fee transactions)
  const calculateSpent = async (): Promise<number> => {
    console.log('BudgetProgress - calculateSpent: Starting calculation for', transactions.length, 'transactions')

    // Sum all transactions (purchases add, returns subtract), excluding canceled and design fee transactions
    let totalAmount = 0

    const activeTransactions = transactions.filter(t =>
      (t.status || '').toLowerCase() !== 'canceled' &&
      t.budget_category !== BudgetCategory.DESIGN_FEE
    )

    for (const transaction of activeTransactions) {
      console.log('BudgetProgress - Processing transaction:', {
        id: transaction.transaction_id,
        type: transaction.transaction_type,
        budget_category: transaction.budget_category,
        amount: transaction.amount
      })

      const transactionAmount = parseFloat(transaction.amount || '0')
      console.log('BudgetProgress - Transaction amount:', transactionAmount)

      const multiplier = transaction.transaction_type === 'Return' ? -1 : 1
      const finalAmount = transactionAmount * multiplier
      totalAmount += finalAmount

      console.log('BudgetProgress - Added', finalAmount, 'to total. Running total:', totalAmount)
    }

    console.log('BudgetProgress - Final total amount (excluding design fee):', totalAmount)
    return totalAmount
  }

  // Calculate spending for each budget category
  const calculateCategoryBudgetData = async (): Promise<CategoryBudgetData[]> => {
    if (!budgetCategories) {
      console.log('BudgetProgress - No budget categories provided')
      return []
    }

    console.log('BudgetProgress - Available budget categories:', budgetCategories)
    console.log('BudgetProgress - Total transactions available:', transactions.length)

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

    for (const { key, label } of categories) {
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
              transaction.budget_category === BudgetCategory.DESIGN_FEE
            )
            .reduce((total, transaction) => {
              const amount = parseFloat(transaction.amount || '0')
              // Apply transaction type multiplier: purchases add, returns subtract
              const multiplier = transaction.transaction_type === 'Return' ? -1 : 1
              return total + (amount * multiplier)
            }, 0)

          const percentage = designFee && designFee > 0 ? (designFeeReceived / designFee) * 100 : 0

          categoryData.push({
            category: label,
            budget: designFee || 0, // Use designFee instead of budgetCategories[key]
            spent: Math.round(designFeeReceived), // For design fee, "spent" represents "received"
            percentage: Math.min(percentage, 100) // Cap at 100%
          })
        } else {
          // Regular categories - track spent vs budget based on transaction amounts directly
          let categorySpent = 0

          const categoryTransactions = transactions.filter(transaction =>
            (transaction.status || '').toLowerCase() !== 'canceled' &&
            transaction.budget_category === label
          )

          console.log(`BudgetProgress - Category ${label}: Found ${categoryTransactions.length} transactions`)

          for (const transaction of categoryTransactions) {
            console.log(`BudgetProgress - Category ${label} - Processing transaction:`, {
              id: transaction.transaction_id,
              type: transaction.transaction_type,
              budget_category: transaction.budget_category,
              amount: transaction.amount
            })

            // Use transaction amount directly for budget calculation
            const transactionAmount = parseFloat(transaction.amount || '0')
            console.log(`BudgetProgress - Category ${label} - Transaction amount:`, transactionAmount)

            // Apply transaction type multiplier: purchases add, returns subtract
            const multiplier = transaction.transaction_type === 'Return' ? -1 : 1
            const finalAmount = transactionAmount * multiplier
            categorySpent += finalAmount

            console.log(`BudgetProgress - Category ${label} - Added ${finalAmount} to category total. Running total:`, categorySpent)
          }

          const percentage = categoryBudget > 0 ? (categorySpent / categoryBudget) * 100 : 0

          categoryData.push({
            category: label,
            budget: categoryBudget,
            spent: Math.round(categorySpent),
            percentage: Math.min(percentage, 100) // Cap at 100%
          })
        }
      }
    }

    return categoryData
  }

  const [spent, setSpent] = useState(0)
  const [percentage, setPercentage] = useState(0)
  const [allCategoryData, setAllCategoryData] = useState<CategoryBudgetData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [computedOverallBudget, setComputedOverallBudget] = useState<number>(budget || 0)

  // Calculate budget data when component mounts or when props change
  useEffect(() => {
    const calculateBudgetData = async () => {
      console.log('BudgetProgress - useEffect triggered with:', {
        budget,
        designFee,
        budgetCategories,
        transactionCount: transactions.length
      })

      setIsLoading(true)

      try {
        const spentAmount = await calculateSpent()
        const categoryData = await calculateCategoryBudgetData()

        // Compute overall budget as the sum of category budgets (exclude designFee key)
        const overallFromCategories = budgetCategories ? Object.entries(budgetCategories).reduce((sum, [key, val]) => {
          if (key === 'designFee') return sum
          return sum + (val as number || 0)
        }, 0) : 0

        const spentRounded = Math.round(spentAmount)
        const percentageValue = overallFromCategories > 0 ? (spentRounded / overallFromCategories) * 100 : 0

        console.log('BudgetProgress - Final results:', {
          spentAmount,
          spentRounded,
          percentageValue,
          overallFromCategories,
          categoryDataLength: categoryData.length
        })

        setSpent(spentRounded)
        setPercentage(percentageValue)
        setAllCategoryData(categoryData)
        setComputedOverallBudget(overallFromCategories)
      } catch (error) {
        console.error('Error calculating budget data:', error)
        setSpent(0)
        setPercentage(0)
        setAllCategoryData([])
      } finally {
        setIsLoading(false)
      }
    }

    calculateBudgetData()
  }, [budget, designFee, budgetCategories, transactions])

  // In preview mode, determine what to show: furnishings budget if it exists, otherwise overall furnishings-only budget
  let categoryData = allCategoryData
  let overallBudgetCategory = null

  if (previewMode) {
    // In preview mode, show only the primary budget (furnishings if set, otherwise overall furnishings-only budget)
    const furnishingsCategory = allCategoryData.find(cat => cat.category === BudgetCategory.FURNISHINGS)
    if (furnishingsCategory) {
      // Show only furnishings budget category
      categoryData = [furnishingsCategory]
    } else if (computedOverallBudget > 0) {
      // No category budgets set, show overall budget (sum of categories, excluding design fee)
      overallBudgetCategory = {
        category: 'Overall Budget' as BudgetCategory,
        budget: computedOverallBudget,
        spent: spent,
        percentage: percentage
      }
    }
  } else {
    // Full mode: Filter categories based on toggle state - show only furnishings by default, others when expanded
    categoryData = allCategoryData.filter(category =>
      category.category === BudgetCategory.FURNISHINGS || showAllCategories
    )

    // Add overall budget as a category if it exists and should be shown
    // Show overall budget only when the toggle is expanded (showAllCategories === true)
    const shouldShowOverallBudget = computedOverallBudget > 0 && showAllCategories

    overallBudgetCategory = shouldShowOverallBudget ? {
      category: 'Overall Budget' as BudgetCategory,
      budget: computedOverallBudget,
      spent: spent,
      percentage: percentage
    } : null
  }

  // Build the final render list and append overall budget at the very bottom (below Design Fee)
  const renderCategories: CategoryBudgetData[] = (() => {
    const cats: CategoryBudgetData[] = [...(categoryData || [])]
    if (overallBudgetCategory) {
      // Always append overall budget at the end of the list
      cats.push(overallBudgetCategory)
    }
    return cats
  })()


  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 75) return 'bg-red-500' // 75%+ spent = bad (red)
    if (percentage >= 50) return 'bg-yellow-500' // 50-74% spent = warning (yellow)
    return 'bg-green-500' // Less than 50% spent = good (green)
  }

  // Color logic for remaining amounts (green when plenty left, yellow when warning, red when over)
  const getRemainingColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600' // Over budget = red
    if (percentage >= 75) return 'text-red-600' // 75%+ spent = bad (red)
    if (percentage >= 50) return 'text-yellow-600' // 50-74% spent = warning (yellow)
    return 'text-green-600' // Less than 50% spent = good (green)
  }

  // Reversed color logic for design fee (green when received, red when not received)
  const getDesignFeeProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500' // Fully received = good (green)
    if (percentage >= 75) return 'bg-green-500' // 75%+ received = good (green)
    if (percentage >= 50) return 'bg-yellow-500' // 50%+ received = warning (yellow)
    return 'bg-red-500' // Less than 50% received = bad (red)
  }

  // Reversed color logic for design fee remaining amounts
  const getDesignFeeRemainingColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600' // Fully received = good (green)
    if (percentage >= 75) return 'text-green-600' // 75%+ received = good (green)
    if (percentage >= 50) return 'text-yellow-600' // 50%+ received = warning (yellow)
    return 'text-red-600' // Less than 50% received = bad (red)
  }

  // Format category names to include "Budget" suffix
  const formatCategoryName = (categoryName: string | BudgetCategory) => {
    // Don't add "Budget" to Design Fee or Overall Budget as they're already clear
    if (categoryName === BudgetCategory.DESIGN_FEE || categoryName === 'Overall Budget') {
      return categoryName
    }
    return `${categoryName} Budget`
  }

  // If no budget or categories are set, don't show anything
  const hasOverallBudget = computedOverallBudget > 0
  const hasDesignFee = designFee !== null && designFee !== undefined && designFee > 0
  const hasCategoryBudgets = budgetCategories && Object.values(budgetCategories).some(v => v > 0)

  // Show loading state while calculating
  if (isLoading) {
    return (
      <div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-2 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    )
  }

  if (!hasOverallBudget && !hasDesignFee && !hasCategoryBudgets) {
    return null
  }

  // In preview mode, use same format as full mode but without toggle and only showing primary budget
  if (previewMode) {
    return (
      <div>
        {/* Category Budget Progress */}
        {(categoryData.length > 0 || overallBudgetCategory) && (
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

  // Full mode with toggle functionality
  return (
    <div>
      {/* Category Budget Progress */}
      {(categoryData.length > 0 || overallBudgetCategory) && (
        <div>

          <div className="space-y-4">
            {renderCategories.map((category) => {
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
          {(allCategoryData.some(cat => cat.category !== BudgetCategory.FURNISHINGS && cat.category !== BudgetCategory.DESIGN_FEE) || (budget !== null && budget !== undefined && budget > 0)) && (
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

