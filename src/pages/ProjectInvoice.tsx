import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import type { Item, Project, Transaction } from '@/types'
import { formatDate } from '@/utils/dateUtils'
import { projectService, transactionService, unifiedItemsService } from '@/services/inventoryService'

type InvoiceItemLine = {
  item: Item
  amount: number
  missingPrice: boolean
}

type InvoiceTransactionLine = {
  transaction: Transaction
  items: InvoiceItemLine[]
  hasItems: boolean
  lineTotal: number
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const INVOICE_LOGO_URL = 'https://storage.googleapis.com/msgsndr/zTjqcEq3Ndj90wvhfc47/media/684c87bb082624ba07154dd6.png'

const getCanonicalTransactionTitle = (transaction: Transaction): string => {
  if (transaction.transaction_id?.startsWith('INV_SALE_')) return '1584 Inventory Sale'
  if (transaction.transaction_id?.startsWith('INV_PURCHASE_')) return '1584 Inventory Purchase'
  return transaction.source
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value
  if (typeof value === 'string') {
    const n = parseFloat(value || '0')
    return isNaN(n) ? 0 : n
  }
  return 0
}

export default function ProjectInvoice() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [clientOwesLines, setClientOwesLines] = useState<InvoiceTransactionLine[]>([])
  const [creditLines, setCreditLines] = useState<InvoiceTransactionLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), [])

  useEffect(() => {
    const load = async () => {
      if (!projectId) {
        navigate('/projects')
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const [proj, txs] = await Promise.all([
          projectService.getProject(projectId),
          transactionService.getTransactions(projectId)
        ])

        if (!proj) {
          navigate('/projects')
          return
        }

        setProject(proj)

        const invoiceable = txs
          .filter(t => t.status !== 'canceled')
          .filter(t => (t.reimbursement_type === 'Client Owes 1584' || t.reimbursement_type === '1584 Owes Client'))

        // Sort by transaction_date ascending within each group later
        // Fetch items for each transaction in parallel
        const lines = await Promise.all(invoiceable.map(async (tx): Promise<InvoiceTransactionLine> => {
          const items: Item[] = await unifiedItemsService.getItemsForTransaction(projectId, tx.transaction_id)

          const itemLines: InvoiceItemLine[] = items.map((it) => {
            const hasPrice = !!it.project_price && it.project_price.trim() !== ''
            const amt = hasPrice ? toNumber(it.project_price || '0') : 0
            return { item: it, amount: amt, missingPrice: !hasPrice }
          })

          const hasItems = itemLines.length > 0
          const lineTotal = hasItems
            ? itemLines.reduce((sum, l) => sum + l.amount, 0)
            : toNumber(tx.amount)

          return { transaction: tx, items: itemLines, hasItems, lineTotal }
        }))

        const clientOwes = lines
          .filter(l => l.transaction.reimbursement_type === 'Client Owes 1584')
          .sort((a, b) => (a.transaction.transaction_date || '').localeCompare(b.transaction.transaction_date || ''))

        const credits = lines
          .filter(l => l.transaction.reimbursement_type === '1584 Owes Client')
          .sort((a, b) => (a.transaction.transaction_date || '').localeCompare(b.transaction.transaction_date || ''))

        setClientOwesLines(clientOwes)
        setCreditLines(credits)
      } catch (e: any) {
        console.error('Failed to load invoice data:', e)
        setError('Failed to load invoice data. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [projectId, navigate])

  const clientOwesSubtotal = useMemo(() => clientOwesLines.reduce((sum, l) => sum + l.lineTotal, 0), [clientOwesLines])
  const creditsSubtotal = useMemo(() => creditLines.reduce((sum, l) => sum + l.lineTotal, 0), [creditLines])
  const netDue = useMemo(() => clientOwesSubtotal - creditsSubtotal, [clientOwesSubtotal, creditsSubtotal])

  const handlePrint = () => window.print()
  const handleBack = () => {
    if (!projectId) return navigate('/projects')
    navigate(`/project/${projectId}?tab=transactions&budgetTab=accounting`)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Building invoice...</p>
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

  const hasAnyLines = clientOwesLines.length > 0 || creditLines.length > 0

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
          <img
            src={INVOICE_LOGO_URL}
            alt="1584 Project Portal logo"
            className="h-24 w-auto object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
            <div className="mt-1 text-sm text-gray-600">
              <div className="font-medium text-gray-800">{project?.name || 'Project'}</div>
              {project?.clientName && <div>Client: {project.clientName}</div>}
              <div>Date: {today}</div>
            </div>
          </div>
        </div>
      </div>

      {!hasAnyLines && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">🧾</div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No invoiceable items</h3>
          <p className="mt-1 text-sm text-gray-500">There are no qualifying transactions for this project.</p>
        </div>
      )}

      {hasAnyLines && (
        <div className="space-y-10">
          {/* Client Owes section */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Project Charges</h2>
            </div>

            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="divide-y">
                {clientOwesLines.map(line => {
                const transactionTitle = getCanonicalTransactionTitle(line.transaction)
                const formattedDate = formatDate(
                  line.transaction.transaction_date,
                  '',
                  {
                    year: undefined,
                    month: 'short',
                    day: 'numeric'
                  }
                )

                return (
                  <div key={line.transaction.transaction_id} className="py-4 px-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-900">
                          <span className="font-medium">{transactionTitle}</span>
                          {formattedDate && <span className="text-xs font-normal text-gray-500">{formattedDate}</span>}
                        </div>
                        {line.transaction.notes && (
                          <div className="text-sm text-gray-500">{line.transaction.notes}</div>
                        )}
                      </div>
                      <div className="text-right text-gray-700">{usd.format(line.lineTotal)}</div>
                    </div>

                    {line.hasItems && (
                      <div className="mt-2 ml-4">
                        <ul className="space-y-1">
                          {line.items.map((it) => (
                            <li key={it.item.item_id} className="flex items-start justify-between text-sm">
                              <div className="text-gray-700">
                                {it.item.description || 'Item'}
                                {it.missingPrice && (
                                  <span className="ml-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1">Missing project price</span>
                                )}
                              </div>
                              <div className="pr-4 text-right text-gray-600">{usd.format(it.amount)}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100">
                <span className="text-base font-semibold text-gray-900">Charges Total</span>
                <span className="text-base font-semibold text-gray-900">{usd.format(clientOwesSubtotal)}</span>
              </div>
            </div>
          </section>

          {/* Credits section */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Project Credits</h2>
            </div>

            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="divide-y">
                {creditLines.map(line => {
                const transactionTitle = getCanonicalTransactionTitle(line.transaction)
                const formattedDate = formatDate(
                  line.transaction.transaction_date,
                  '',
                  {
                    year: undefined,
                    month: 'short',
                    day: 'numeric'
                  }
                )

                return (
                  <div key={line.transaction.transaction_id} className="py-4 px-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-900">
                          <span className="font-medium">{transactionTitle}</span>
                          {formattedDate && <span className="text-xs font-normal text-gray-500">{formattedDate}</span>}
                        </div>
                        {line.transaction.notes && (
                          <div className="text-sm text-gray-500">{line.transaction.notes}</div>
                        )}
                      </div>
                      <div className="text-right text-gray-700">{usd.format(line.lineTotal)}</div>
                    </div>

                    {line.hasItems && (
                      <div className="mt-2 ml-4">
                        <ul className="space-y-1">
                          {line.items.map((it) => (
                            <li key={it.item.item_id} className="flex items-start justify-between text-sm">
                              <div className="text-gray-700">
                                {it.item.description || 'Item'}
                                {it.missingPrice && (
                                  <span className="ml-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1">Missing project price</span>
                                )}
                              </div>
                              <div className="pr-4 text-right text-gray-600">{usd.format(it.amount)}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100">
                <span className="text-base font-semibold text-gray-900">Credits Total</span>
                <span className="text-base font-semibold text-gray-900">{usd.format(creditsSubtotal)}</span>
              </div>
            </div>
          </section>

          {/* Net Due */}
          <section className="border-t pt-4">
            <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-primary-600">Net Amount Due</h2>
          <div className="text-xl font-bold text-primary-600">{usd.format(netDue)}</div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}


