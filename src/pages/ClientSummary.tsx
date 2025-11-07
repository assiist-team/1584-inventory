import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import type { Item, Project, Transaction } from '@/types'
import { projectService, transactionService, unifiedItemsService } from '@/services/inventoryService'
import { useAccount } from '@/contexts/AccountContext'
import { useBusinessProfile } from '@/contexts/BusinessProfileContext'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value
  if (typeof value === 'string') {
    const n = parseFloat(value || '0')
    return isNaN(n) ? 0 : n
  }
  return 0
}

export default function ClientSummary() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAccount()
  const { businessName, businessLogoUrl } = useBusinessProfile()

  const [project, setProject] = useState<Project | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), [])

  useEffect(() => {
    const load = async () => {
      if (!projectId || !currentAccountId) {
        if (!currentAccountId) return // Wait for account to load
        navigate('/projects')
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const [proj, projectItems, projectTransactions] = await Promise.all([
          projectService.getProject(currentAccountId, projectId),
          unifiedItemsService.getItemsByProject(currentAccountId, projectId),
          transactionService.getTransactions(currentAccountId, projectId)
        ])

        if (!proj) {
          navigate('/projects')
          return
        }

        setProject(proj)
        setItems(projectItems)
        setTransactions(projectTransactions)
      } catch (e: any) {
        console.error('Failed to load client summary:', e)
        setError('Failed to load client summary. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [projectId, currentAccountId, navigate])

  // Calculate summary values
  const summary = useMemo(() => {
    // Total spent overall (sum of projectPrice for all items)
    const totalSpent = items.reduce((sum, item) => {
      const projectPrice = toNumber(item.projectPrice)
      return sum + projectPrice
    }, 0)

    // Breakdown by budget categories (sum of transaction amounts by budgetCategory)
    const categoryBreakdown: Record<string, number> = {}
    transactions.forEach(transaction => {
      if (transaction.budgetCategory) {
        const amount = toNumber(transaction.amount)
        categoryBreakdown[transaction.budgetCategory] = (categoryBreakdown[transaction.budgetCategory] || 0) + amount
      }
    })

    // Value of furnishings in home (sum of marketValue for all items)
    const totalMarketValue = items.reduce((sum, item) => {
      const marketValue = toNumber(item.marketValue)
      return sum + marketValue
    }, 0)

    // What they saved (sum of differences between marketValue and projectPrice for each item)
    // If marketValue is not set, difference is zero
    const totalSaved = items.reduce((sum, item) => {
      const marketValue = toNumber(item.marketValue)
      const projectPrice = toNumber(item.projectPrice)
      // Only count savings if marketValue is set (greater than 0)
      if (marketValue > 0) {
        return sum + (marketValue - projectPrice)
      }
      return sum
    }, 0)

    return {
      totalSpent,
      categoryBreakdown,
      totalMarketValue,
      totalSaved
    }
  }, [items, transactions])

  const handlePrint = () => window.print()
  const handleBack = () => {
    if (!projectId) return navigate('/projects')
    navigate(`/project/${projectId}?tab=inventory`)
  }

  // Helper to get receipt link for an item
  const getReceiptLink = (item: Item): string | null => {
    if (item.transactionId && projectId) {
      return `/project/${projectId}/transaction/${item.transactionId}`
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading client summary...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-red-400">⚠️</div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <div className="mt-6">
          <Button onClick={handleBack}>Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto bg-white shadow rounded-lg p-8 print:shadow-none print:p-0">
      {/* Action bar */}
      <div className="flex justify-end space-x-3 mb-6 print:hidden">
        <Button variant="secondary" onClick={handleBack}>Back</Button>
        <Button onClick={handlePrint}>Print</Button>
      </div>

      {/* Header */}
      <div className="border-b pb-4 mb-6">
        <div className="flex items-start gap-4">
          {businessLogoUrl && (
            <img
              src={businessLogoUrl}
              alt={businessName}
              className="h-24 w-auto object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Summary</h1>
            <div className="mt-1 text-sm text-gray-600">
              <div className="font-medium text-gray-800">{project?.name || 'Project'}</div>
              {project?.clientName && <div>Client: {project.clientName}</div>}
              <div>Date: {today}</div>
            </div>
          </div>
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">📦</div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
          <p className="mt-1 text-sm text-gray-500">There are no items associated with this project.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-6">
          {/* Summary Fields */}
          <section>
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
              </div>
              <div className="px-4 py-4 space-y-4">
                {/* Total Spent Overall */}
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-700">Total Spent Overall</span>
                  <span className="text-base font-semibold text-gray-900">{usd.format(summary.totalSpent)}</span>
                </div>

                {/* Breakdown by Budget Categories */}
                {Object.keys(summary.categoryBreakdown).length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-sm font-medium text-gray-700 mb-2">Breakdown by Budget Category</div>
                    <div className="space-y-2">
                      {Object.entries(summary.categoryBreakdown)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([category, amount]) => (
                          <div key={category} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{category}</span>
                            <span className="text-gray-900 font-medium">{usd.format(amount)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Value of Furnishings */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-gray-700">Value of Furnishings in Your Home</span>
                    <span className="text-base font-semibold text-gray-900">{usd.format(summary.totalMarketValue)}</span>
                  </div>
                </div>

                {/* What They Spent */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-gray-700">What You Spent</span>
                    <span className="text-base font-semibold text-gray-900">{usd.format(summary.totalSpent)}</span>
                  </div>
                </div>

                {/* What They Saved */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-primary-600">What You Saved</span>
                    <span className="text-base font-semibold text-primary-600">{usd.format(summary.totalSaved)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Items List */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Items</h2>
            </div>

            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="divide-y">
                {items.map((item) => {
                  const projectPrice = toNumber(item.projectPrice)
                  const receiptLink = getReceiptLink(item)
                  
                  return (
                    <div key={item.itemId} className="py-4 px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-gray-900 font-medium">
                            {item.description || 'Item'}
                          </div>
                          {item.source && (
                            <div className="text-sm text-gray-500 mt-1">Source: {item.source}</div>
                          )}
                          {item.space && (
                            <div className="text-sm text-gray-500 mt-1">Space: {item.space}</div>
                          )}
                          {receiptLink && (
                            <div className="mt-2">
                              <Link
                                to={receiptLink}
                                className="text-sm text-primary-600 hover:text-primary-700 underline print:hidden"
                              >
                                View Receipt
                              </Link>
                              <span className="text-sm text-primary-600 print:inline hidden">
                                Receipt available
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-gray-700 font-medium">
                            {usd.format(projectPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100">
                <span className="text-base font-semibold text-gray-900">Total Project Price</span>
                <span className="text-base font-semibold text-gray-900">{usd.format(summary.totalSpent)}</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

