import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, FileUp, Save, Shield, Trash2 } from 'lucide-react'
import ContextBackLink from '@/components/ContextBackLink'
import TransactionItemsList from '@/components/TransactionItemsList'
import CategorySelect from '@/components/CategorySelect'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/ToastContext'
import { useNavigationContext } from '@/hooks/useNavigationContext'
import { useStackedNavigate } from '@/hooks/useStackedNavigate'
import { useAuth } from '@/contexts/AuthContext'
import { useAccount } from '@/contexts/AccountContext'
import { extractPdfText } from '@/utils/pdfTextExtraction'
import { parseWayfairInvoiceText, WayfairInvoiceLineItem, WayfairInvoiceParseResult } from '@/utils/wayfairInvoiceParser'
import { normalizeMoneyToTwoDecimalString, parseMoneyToNumber } from '@/utils/money'
import { getDefaultCategory } from '@/services/accountPresetsService'
import { projectService, transactionService } from '@/services/inventoryService'
import { COMPANY_NAME } from '@/constants/company'
import type { TransactionItemFormData } from '@/types'

function getTodayIsoDate(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function formatCurrencyFromString(amount: string): string {
  const n = Number.parseFloat(amount)
  if (!Number.isFinite(n)) return '$0.00'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sumLineTotals(lineItems: WayfairInvoiceLineItem[]): string {
  const sum = lineItems.reduce((acc, li) => acc + (parseMoneyToNumber(li.total) || 0), 0)
  return sum.toFixed(2)
}

function buildTransactionItems(lineItems: WayfairInvoiceLineItem[]): TransactionItemFormData[] {
  const items: TransactionItemFormData[] = []

  for (const li of lineItems) {
    const qty = Math.max(1, Math.floor(li.qty || 1))
    const totalNum = parseMoneyToNumber(li.total)
    const unitPriceNum = li.unitPrice ? parseMoneyToNumber(li.unitPrice) : undefined

    // Preferred: total/qty. Fallback: unitPrice. Last resort: total (when qty is 1).
    const perUnitFromTotal = totalNum !== undefined ? totalNum / qty : undefined
    const perUnit = (perUnitFromTotal ?? unitPriceNum ?? totalNum ?? 0)
    const perUnitMoney = normalizeMoneyToTwoDecimalString(String(perUnit)) || '0.00'

    const baseNotesParts: string[] = []
    if (li.shippedOn) baseNotesParts.push(`Wayfair shipped on ${li.shippedOn}`)
    if (li.section === 'to_be_shipped') baseNotesParts.push('Wayfair: items to be shipped')
    const baseNotes = baseNotesParts.length > 0 ? baseNotesParts.join(' • ') : 'Wayfair import'

    for (let i = 0; i < qty; i++) {
      const suffix = qty > 1 ? ` (${i + 1}/${qty})` : ''
      items.push({
        id: crypto.randomUUID(),
        description: `${li.description}${suffix}`.trim(),
        purchasePrice: perUnitMoney,
        price: perUnitMoney,
        notes: baseNotes,
      })
    }
  }

  return items
}

export default function ImportWayfairInvoice() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useStackedNavigate()
  const { user, isOwner } = useAuth()
  const { currentAccountId } = useAccount()
  const { getBackDestination } = useNavigationContext()
  const { showError, showInfo, showSuccess, showWarning } = useToast()

  if (!currentAccountId && !isOwner()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600">
            You don&apos;t have permission to import transactions. Please contact an administrator if you need access.
          </p>
          <ContextBackLink
            fallback={getBackDestination(`/project/${projectId}`)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Project
          </ContextBackLink>
        </div>
      </div>
    )
  }

  const [projectName, setProjectName] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseResult, setParseResult] = useState<WayfairInvoiceParseResult | null>(null)
  const [includeToBeShipped, setIncludeToBeShipped] = useState(true)
  const [transactionDate, setTransactionDate] = useState(getTodayIsoDate())
  const [paymentMethod, setPaymentMethod] = useState<string>('Client Card')
  const [amount, setAmount] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [taxRatePreset, setTaxRatePreset] = useState<string | undefined>(undefined)
  const [subtotal, setSubtotal] = useState<string>('')
  const [items, setItems] = useState<TransactionItemFormData[]>([])
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !currentAccountId) return
      try {
        const project = await projectService.getProject(currentAccountId, projectId)
        if (project?.name) setProjectName(project.name)
      } catch (e) {
        console.error('Failed to load project:', e)
      }
    }
    loadProject()
  }, [projectId, currentAccountId])

  useEffect(() => {
    const loadAccountDefaultCategory = async () => {
      if (!currentAccountId) return
      try {
        const defaultCategory = await getDefaultCategory(currentAccountId)
        if (defaultCategory) setCategoryId(defaultCategory)
      } catch (err) {
        console.error('Failed to load account default category:', err)
      }
    }
    loadAccountDefaultCategory()
  }, [currentAccountId])

  const includedLineItems = useMemo(() => {
    if (!parseResult) return []
    if (includeToBeShipped) return parseResult.lineItems
    return parseResult.lineItems.filter(li => li.section !== 'to_be_shipped')
  }, [parseResult, includeToBeShipped])

  const parseStats = useMemo(() => {
    if (!parseResult) return null
    const shipped = parseResult.lineItems.filter(li => li.section === 'shipped').length
    const toBeShipped = parseResult.lineItems.filter(li => li.section === 'to_be_shipped').length
    const unknown = parseResult.lineItems.filter(li => li.section === 'unknown').length
    return { shipped, toBeShipped, unknown, total: parseResult.lineItems.length }
  }, [parseResult])

  const handleReset = () => {
    setSelectedFile(null)
    setParseResult(null)
    setIncludeToBeShipped(true)
    setTransactionDate(getTodayIsoDate())
    setPaymentMethod('Client Card')
    setAmount('')
    setNotes('')
    setTaxRatePreset(undefined)
    setSubtotal('')
    setItems([])
    setGeneralError(null)
  }

  const applyParsedInvoiceToDraft = (result: WayfairInvoiceParseResult, nextIncludeToBeShipped: boolean) => {
    const today = getTodayIsoDate()
    setTransactionDate(result.orderDate || today)

    const lineItemsForAmount = nextIncludeToBeShipped ? result.lineItems : result.lineItems.filter(li => li.section !== 'to_be_shipped')
    const computedSum = sumLineTotals(lineItemsForAmount)
    const defaultAmount = (nextIncludeToBeShipped && result.orderTotal) ? result.orderTotal : computedSum
    setAmount(defaultAmount)

    const hasSubtotal = Boolean(result.subtotal && result.orderTotal)
    if (hasSubtotal && result.subtotal) {
      setTaxRatePreset('Other')
      setSubtotal(result.subtotal)
    } else {
      setTaxRatePreset(undefined)
      setSubtotal('')
    }

    const notesParts: string[] = []
    notesParts.push('Wayfair import')
    if (result.invoiceNumber) notesParts.push(`Invoice # ${result.invoiceNumber}`)
    if (result.orderDate) notesParts.push(`Order date: ${result.orderDate}`)
    if (nextIncludeToBeShipped === false) notesParts.push('Excluded: Items to be Shipped section')
    setNotes(notesParts.join(' • '))

    const nextItems = buildTransactionItems(lineItemsForAmount)
    setItems(nextItems)
  }

  const parsePdf = async (file: File) => {
    if (!file) return
    setGeneralError(null)
    setIsParsing(true)
    try {
      const { fullText } = await extractPdfText(file)
      const result = parseWayfairInvoiceText(fullText)
      setParseResult(result)
      applyParsedInvoiceToDraft(result, includeToBeShipped)
      if (result.warnings.length > 0) {
        showWarning(`Parsed with ${result.warnings.length} warning(s). Review before creating.`)
      } else {
        showSuccess('Parsed successfully. Review and create when ready.')
      }
    } catch (err) {
      console.error('Failed to parse PDF:', err)
      setParseResult(null)
      setItems([])
      setGeneralError(err instanceof Error ? err.message : 'Failed to parse PDF. Please try again.')
      showError('Failed to parse PDF.')
    } finally {
      setIsParsing(false)
    }
  }

  const validateBeforeCreate = (): string | null => {
    if (!projectId) return 'Missing project ID.'
    if (!currentAccountId) return 'No account found.'
    if (!user?.id) return 'You must be signed in to create a transaction.'
    if (!parseResult) return 'No parsed invoice data. Upload and parse a PDF first.'
    if (!amount.trim() || !Number.isFinite(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0) return 'Amount must be a positive number.'

    if (taxRatePreset === 'Other') {
      const subtotalNum = Number.parseFloat(subtotal)
      const amountNum = Number.parseFloat(amount)
      if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) return 'Subtotal must be provided and greater than 0 when Tax Rate Preset is Other.'
      if (!Number.isFinite(amountNum) || amountNum < subtotalNum) return 'Subtotal cannot exceed the total amount.'
    }

    for (const item of items) {
      if (!item.description?.trim()) return 'Each item must have a description.'
      const priceNum = item.purchasePrice ? Number.parseFloat(item.purchasePrice) : NaN
      if (!Number.isFinite(priceNum) || priceNum < 0) return 'Each item must have a valid purchase price (>= 0).'
    }

    return null
  }

  const handleCreate = async () => {
    const validationError = validateBeforeCreate()
    if (validationError) {
      setGeneralError(validationError)
      showError(validationError)
      return
    }
    if (!projectId || !currentAccountId || !user?.id) return

    setGeneralError(null)
    setIsCreating(true)
    try {
      const transactionData = {
        projectId,
        projectName,
        transactionDate,
        source: 'Wayfair',
        transactionType: 'Purchase',
        paymentMethod,
        amount: normalizeMoneyToTwoDecimalString(amount) || amount,
        categoryId: categoryId || undefined,
        notes: notes || undefined,
        receiptEmailed: false,
        createdBy: user.id,
        status: 'completed' as const,
        triggerEvent: 'Manual' as const,
        taxRatePreset,
        subtotal: taxRatePreset === 'Other' ? (normalizeMoneyToTwoDecimalString(subtotal) || subtotal) : undefined,
      }

      const transactionId = await transactionService.createTransaction(currentAccountId, projectId, transactionData as any, items)
      showSuccess('Transaction created.')
      navigate(`/project/${projectId}/transaction/${transactionId}`)
    } catch (err) {
      console.error('Failed to create transaction from Wayfair invoice:', err)
      const message = err instanceof Error ? err.message : 'Failed to create transaction. Please try again.'
      setGeneralError(message)
      showError(message)
    } finally {
      setIsCreating(false)
    }
  }

  const onFileSelected = (file: File | null) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      showError('Please select a PDF file.')
      return
    }
    setSelectedFile(file)
    setParseResult(null)
    setItems([])
    void parsePdf(file)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <ContextBackLink
            fallback={getBackDestination(`/project/${projectId}?tab=transactions`)}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </ContextBackLink>

          <button
            type="button"
            onClick={() => {
              handleReset()
              showInfo('Importer reset.')
            }}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
            title="Reset importer"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Reset
          </button>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Import Wayfair Invoice</h1>
            <p className="text-sm text-gray-600 mt-1">
              {projectName ? `Project: ${projectName}` : 'Project transaction import'}
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Invoice PDF</label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const file = e.dataTransfer.files?.[0] || null
                  onFileSelected(file)
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <FileUp className="h-5 w-5 text-primary-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedFile ? selectedFile.name : 'Drag and drop a Wayfair invoice PDF here'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Or use the file picker. Parsing happens locally in your browser.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-700"
                    />
                  </div>
                </div>

                {isParsing && (
                  <div className="mt-4">
                    <LoadingSpinner size="sm" />
                    <p className="mt-2 text-xs text-gray-500 text-center">Parsing PDF…</p>
                  </div>
                )}
              </div>
            </div>

            {/* Parse Summary */}
            {parseResult && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Invoice</p>
                    <p className="text-sm font-medium text-gray-900">
                      {parseResult.invoiceNumber ? `#${parseResult.invoiceNumber}` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Order total (parsed)</p>
                    <p className="text-sm font-medium text-gray-900">
                      {parseResult.orderTotal ? formatCurrencyFromString(parseResult.orderTotal) : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Detected line items</p>
                    <p className="text-sm font-medium text-gray-900">
                      {parseStats ? `${parseStats.total} (shipped ${parseStats.shipped}, to-be-shipped ${parseStats.toBeShipped})` : `${parseResult.lineItems.length}`}
                    </p>
                  </div>
                </div>

                {parseResult.warnings.length > 0 && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="text-sm font-medium text-amber-800">Warnings</p>
                    <ul className="mt-2 text-sm text-amber-800 list-disc pl-5 space-y-1">
                      {parseResult.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Include toggle */}
            {parseResult && (
              <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <input
                  id="includeToBeShipped"
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={includeToBeShipped}
                  onChange={(e) => {
                    const next = e.target.checked
                    if (items.length > 0) {
                      showWarning('Changing this will rebuild items from the invoice and discard item edits.')
                    }
                    setIncludeToBeShipped(next)
                    if (parseResult) applyParsedInvoiceToDraft(parseResult, next)
                  }}
                />
                <div className="flex-1">
                  <label htmlFor="includeToBeShipped" className="text-sm font-medium text-gray-900">
                    Include “Items to be Shipped”
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    If unchecked, the transaction amount will default to the sum of included line totals ({formatCurrencyFromString(sumLineTotals(includedLineItems))}).
                  </p>
                </div>
              </div>
            )}

            {/* Transaction fields */}
            {parseResult && (
              <div className="space-y-4">
                {generalError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="mt-1 text-sm text-red-700">{generalError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Transaction Date</label>
                    <input
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                    <div className="mt-2 flex items-center gap-6">
                      <label className="flex items-center gap-2 text-sm text-gray-900">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="Client Card"
                          checked={paymentMethod === 'Client Card'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        Client Card
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-900">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={COMPANY_NAME}
                          checked={paymentMethod === COMPANY_NAME}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        {COMPANY_NAME}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Amount</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Sum of included line totals: {formatCurrencyFromString(sumLineTotals(includedLineItems))}
                    </p>
                  </div>

                  <div>
                    <CategorySelect
                      value={categoryId}
                      onChange={(id) => setCategoryId(id)}
                      label="Budget Category"
                      required={false}
                      helperText="Optional, but recommended for budget tracking."
                    />
                  </div>
                </div>

                {/* Tax (Optional) */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Tax handling</p>
                      <p className="text-xs text-gray-500 mt-1">
                        If the invoice subtotal was parsed, we set Tax Rate Preset to “Other” and compute the rate from subtotal → total.
                      </p>
                    </div>
                    <div className="text-sm text-gray-700">
                      {taxRatePreset === 'Other' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary-100 text-primary-800">
                          Other (computed)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-200 text-gray-700">
                          Not set
                        </span>
                      )}
                    </div>
                  </div>

                  {taxRatePreset === 'Other' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">Subtotal</label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="text"
                          value={subtotal}
                          onChange={(e) => setSubtotal(e.target.value)}
                          className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <TransactionItemsList
                  items={items}
                  onItemsChange={(next) => setItems(next)}
                  projectId={projectId}
                  projectName={projectName}
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isParsing || isCreating}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isCreating ? 'Creating…' : 'Create Transaction'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


