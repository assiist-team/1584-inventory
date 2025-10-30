import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Transaction, Project, TaxPreset } from '@/types'
import { transactionService, projectService } from '@/services/inventoryService'
import { toDateOnlyString } from '@/utils/dateUtils'
import { TRANSACTION_SOURCES } from '@/constants/transactionSources'
import { getTaxPresets } from '@/services/taxPresetsService'

export default function EditBusinessInventoryTransaction() {
  const { projectId, transactionId } = useParams<{ projectId: string; transactionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState({
    project_id: '',
    transaction_date: '',
    source: '',
    transaction_type: 'Reimbursement',
    payment_method: 'Pending',
    amount: '',
    budget_category: 'Furnishings',
    notes: '',
    status: 'pending' as 'pending' | 'completed' | 'canceled',
    reimbursement_type: '' as string,
    trigger_event: 'Manual' as 'Inventory allocation' | 'Inventory return' | 'Inventory sale' | 'Purchase from client' | 'Manual',
    receipt_emailed: false
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isCustomSource, setIsCustomSource] = useState(false)

  // Tax form state
  const [taxRatePreset, setTaxRatePreset] = useState<string | undefined>(undefined)
  const [subtotal, setSubtotal] = useState<string>('')
  const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([])
  const [selectedPresetRate, setSelectedPresetRate] = useState<number | undefined>(undefined)

  // Navigation context logic
  const backDestination = useMemo(() => {
    // Check if we have a returnTo parameter
    const searchParams = new URLSearchParams(location.search)
    const returnTo = searchParams.get('returnTo')
    if (returnTo) return returnTo

    // Default fallback
    return '/business-inventory'
  }, [location.search])

  // Load tax presets on mount
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const presets = await getTaxPresets()
        setTaxPresets(presets)
      } catch (error) {
        console.error('Error loading tax presets:', error)
      }
    }
    loadPresets()
  }, [])

  // Update selected preset rate when preset changes
  useEffect(() => {
    if (taxRatePreset && taxRatePreset !== 'Other') {
      const preset = taxPresets.find(p => p.id === taxRatePreset)
      setSelectedPresetRate(preset?.rate)
    } else {
      setSelectedPresetRate(undefined)
    }
    // Clear general error when tax preset changes
    if (formErrors.general) {
      setFormErrors(prev => ({ ...prev, general: '' }))
    }
  }, [taxRatePreset, taxPresets])

  // Clear general error when subtotal changes
  useEffect(() => {
    if (formErrors.general) {
      setFormErrors(prev => ({ ...prev, general: '' }))
    }
  }, [subtotal])

  // Load projects and transaction data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [projectsData, transactionData] = await Promise.all([
          projectService.getProjects(),
          projectId && transactionId ? transactionService.getTransaction(projectId, transactionId) :
            transactionId ? transactionService.getTransactionById(transactionId).then(result => result.transaction) : null
        ])

        setProjects(projectsData)

        if (transactionData) {
          setTransaction(transactionData)
          const resolvedSource = transactionData.source || ''
          // Check if source is custom (not in predefined list)
          const sourceIsCustom = Boolean(resolvedSource && !TRANSACTION_SOURCES.includes(resolvedSource as any))
          
          setFormData({
            project_id: transactionData.project_id || '',
            transaction_date: toDateOnlyString(transactionData.transaction_date) || '',
            source: resolvedSource,
            transaction_type: transactionData.transaction_type,
            payment_method: transactionData.payment_method,
            amount: transactionData.amount,
            budget_category: transactionData.budget_category || 'Furnishings',
            notes: transactionData.notes || '',
            status: transactionData.status || 'pending',
            reimbursement_type: transactionData.reimbursement_type || '',
            trigger_event: transactionData.trigger_event || 'Manual',
            receipt_emailed: transactionData.receipt_emailed
          })

          // Populate tax fields if present
          if (transactionData.tax_rate_preset) {
            setTaxRatePreset(transactionData.tax_rate_preset)
          }
          setSubtotal(transactionData.subtotal || '')
          
          setIsCustomSource(sourceIsCustom)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [projectId, transactionId])

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
    // Clear general error when any field changes
    if (formErrors.general) {
      setFormErrors(prev => ({ ...prev, general: '' }))
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    // Project selection is optional
    // Transaction date is optional

    if (!formData.source.trim()) {
      errors.source = 'Source is required'
    }

    if (!formData.budget_category?.trim()) {
      errors.budget_category = 'Budget category is required'
    }

    if (!formData.amount.trim()) {
      errors.amount = 'Amount is required'
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      errors.amount = 'Amount must be a positive number'
    }

    // Tax validation for Other
    if (taxRatePreset === 'Other') {
      if (!subtotal.trim() || isNaN(Number(subtotal)) || Number(subtotal) <= 0) {
        errors.general = 'Subtotal must be provided and greater than 0 when Tax Rate Preset is Other.'
      } else if (Number(formData.amount) < Number(subtotal)) {
        errors.general = 'Subtotal cannot exceed the total amount.'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!projectId || !transactionId || !validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Determine project_id based on selection
      const actualProjectId = formData.project_id === 'business-inventory' ? null : formData.project_id

      const updateData = {
        ...formData,
        project_id: actualProjectId,
        // Include tax fields only when a tax rate preset is explicitly selected.
        ...(taxRatePreset ? { tax_rate_preset: taxRatePreset, subtotal: taxRatePreset === 'Other' ? subtotal : '' } : { subtotal: '' })
      }

      await transactionService.updateTransaction(actualProjectId || '', transactionId, updateData)
      navigate(`/business-inventory`)
    } catch (error) {
      console.error('Error updating transaction:', error)
      setFormErrors({ general: 'Error updating transaction. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate(backDestination)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="text-center py-12 px-4">
        <div className="mx-auto h-16 w-16 text-gray-400 -mb-1">🧾</div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          Transaction not found
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          The transaction you're looking for doesn't exist or has been deleted.
        </p>
        <Link
          to={backDestination}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          Back to Business Inventory
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Back button row */}
        <div className="flex items-center justify-between">
          <Link
            to={backDestination}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Edit Transaction</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* General Error Display */}
          {formErrors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{formErrors.general}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Project Selection */}
          <div>
            <label htmlFor="project_id" className="block text-sm font-medium text-gray-700">
              Project
            </label>
            <select
              id="project_id"
              value={formData.project_id}
              onChange={(e) => handleInputChange('project_id', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                formErrors.project_id ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select a project...</option>
              <option value="business-inventory">Business Inventory (No Project)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} - {project.clientName}
                </option>
              ))}
            </select>
            {formErrors.project_id && (
              <p className="mt-1 text-sm text-red-600">{formErrors.project_id}</p>
            )}
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Source/Vendor *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              {TRANSACTION_SOURCES.map((source) => (
                <div key={source} className="flex items-center">
                  <input
                    type="radio"
                    id={`source_${source.toLowerCase().replace(/\s+/g, '_')}`}
                    name="source"
                    value={source}
                    checked={formData.source === source}
                    onChange={(e) => {
                      handleInputChange('source', e.target.value)
                      setIsCustomSource(false)
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <label htmlFor={`source_${source.toLowerCase().replace(/\s+/g, '_')}`} className="ml-2 block text-sm text-gray-900">
                    {source}
                  </label>
                </div>
              ))}
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="source_custom"
                name="source"
                value="custom"
                checked={isCustomSource}
                onChange={() => {
                  setIsCustomSource(true)
                  handleInputChange('source', '')
                }}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="source_custom" className="ml-2 block text-sm text-gray-900">
                Other
              </label>
            </div>
            {isCustomSource && (
              <input
                type="text"
                id="source_custom_input"
                value={formData.source}
                onChange={(e) => handleInputChange('source', e.target.value)}
                placeholder="Enter custom source..."
                className={`mt-3 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                  formErrors.source ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            )}
            {formErrors.source && (
              <p className="mt-1 text-sm text-red-600">{formErrors.source}</p>
            )}
          </div>

          {/* Budget Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Budget Category *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="budget_design_fee"
                  name="budget_category"
                  value="Design Fee"
                  checked={formData.budget_category === 'Design Fee'}
                  onChange={(e) => handleInputChange('budget_category', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="budget_design_fee" className="ml-2 block text-sm text-gray-900">
                  Design Fee
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="budget_furnishings"
                  name="budget_category"
                  value="Furnishings"
                  checked={formData.budget_category === 'Furnishings'}
                  onChange={(e) => handleInputChange('budget_category', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="budget_furnishings" className="ml-2 block text-sm text-gray-900">
                  Furnishings
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="budget_property_management"
                  name="budget_category"
                  value="Property Management"
                  checked={formData.budget_category === 'Property Management'}
                  onChange={(e) => handleInputChange('budget_category', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="budget_property_management" className="ml-2 block text-sm text-gray-900">
                  Property Management
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="budget_kitchen"
                  name="budget_category"
                  value="Kitchen"
                  checked={formData.budget_category === 'Kitchen'}
                  onChange={(e) => handleInputChange('budget_category', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="budget_kitchen" className="ml-2 block text-sm text-gray-900">
                  Kitchen
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="budget_install"
                  name="budget_category"
                  value="Install"
                  checked={formData.budget_category === 'Install'}
                  onChange={(e) => handleInputChange('budget_category', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="budget_install" className="ml-2 block text-sm text-gray-900">
                  Install
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="budget_storage_receiving"
                  name="budget_category"
                  value="Storage & Receiving"
                  checked={formData.budget_category === 'Storage & Receiving'}
                  onChange={(e) => handleInputChange('budget_category', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="budget_storage_receiving" className="ml-2 block text-sm text-gray-900">
                  Storage & Receiving
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="budget_fuel"
                  name="budget_category"
                  value="Fuel"
                  checked={formData.budget_category === 'Fuel'}
                  onChange={(e) => handleInputChange('budget_category', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="budget_fuel" className="ml-2 block text-sm text-gray-900">
                  Fuel
                </label>
              </div>
            </div>
            {formErrors.budget_category && (
              <p className="mt-1 text-sm text-red-600">{formErrors.budget_category}</p>
            )}
          </div>

          {/* Reimbursement Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Reimbursement Type
            </label>
            <p className="mb-3 text-xs text-gray-500">Flags transactions that require reimbursement</p>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="reimbursement_none"
                  name="reimbursement_type"
                  value=""
                  checked={!formData.reimbursement_type}
                  onChange={(e) => handleInputChange('reimbursement_type', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="reimbursement_none" className="ml-2 block text-sm text-gray-900">
                  None
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="reimbursement_client_owes"
                  name="reimbursement_type"
                  value="Client Owes 1584"
                  checked={formData.reimbursement_type === 'Client Owes 1584'}
                  onChange={(e) => handleInputChange('reimbursement_type', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="reimbursement_client_owes" className="ml-2 block text-sm text-gray-900">
                  Client Owes 1584
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="reimbursement_we_owe"
                  name="reimbursement_type"
                  value="1584 Owes Client"
                  checked={formData.reimbursement_type === '1584 Owes Client'}
                  onChange={(e) => handleInputChange('reimbursement_type', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="reimbursement_we_owe" className="ml-2 block text-sm text-gray-900">
                  1584 Owes Client
                </label>
              </div>
            </div>
            {formErrors.reimbursement_type && (
              <p className="mt-1 text-sm text-red-600">{formErrors.reimbursement_type}</p>
            )}
          </div>

          {/* Receipt Email Copy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Receipt Email Copy
            </label>
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="receipt_yes"
                  name="receipt_emailed"
                  checked={formData.receipt_emailed === true}
                  onChange={() => handleInputChange('receipt_emailed', true)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="receipt_yes" className="ml-2 block text-sm text-gray-900">
                  Yes
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="receipt_no"
                  name="receipt_emailed"
                  checked={formData.receipt_emailed === false}
                  onChange={() => handleInputChange('receipt_emailed', false)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="receipt_no" className="ml-2 block text-sm text-gray-900">
                  No
                </label>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount *
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                id="amount"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                className={`block w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                  formErrors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            </div>
            {formErrors.amount && (
              <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p>
            )}
          </div>

          {/* Tax Rate Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Tax Rate Preset</label>
            <div className="space-y-2">
              {taxPresets.map((preset) => (
                <div key={preset.id} className="flex items-center">
                  <input
                    type="radio"
                    id={`tax_preset_${preset.id}`}
                    name="tax_rate_preset"
                    value={preset.id}
                    checked={taxRatePreset === preset.id}
                    onChange={(e) => setTaxRatePreset(e.target.value)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <label htmlFor={`tax_preset_${preset.id}`} className="ml-2 block text-sm text-gray-900">
                    {preset.name} ({preset.rate.toFixed(2)}%)
                  </label>
                </div>
              ))}
              <div className="flex items-center">
                <input
                  type="radio"
                  id="tax_preset_other"
                  name="tax_rate_preset"
                  value="Other"
                  checked={taxRatePreset === 'Other'}
                  onChange={(e) => setTaxRatePreset(e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="tax_preset_other" className="ml-2 block text-sm text-gray-900">
                  Other
                </label>
              </div>
            </div>
            {/* Show selected tax rate for presets */}
            {taxRatePreset && taxRatePreset !== 'Other' && selectedPresetRate !== undefined && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Tax Rate:</span> {selectedPresetRate.toFixed(2)}%
                </p>
              </div>
            )}
          </div>

          {/* Subtotal (shown only for Other) */}
          {taxRatePreset === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Subtotal</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="text"
                  id="subtotal"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  placeholder="0.00"
                  className={`block w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 border-gray-300`}
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">This will be used to calculate the tax rate.</p>
            </div>
          )}

          {/* Transaction Date */}
          <div>
            <label htmlFor="transaction_date" className="block text-sm font-medium text-gray-700">
              Transaction Date
            </label>
            <input
              type="date"
              id="transaction_date"
              value={formData.transaction_date}
              onChange={(e) => handleInputChange('transaction_date', e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                formErrors.transaction_date ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {formErrors.transaction_date && (
              <p className="mt-1 text-sm text-red-600">{formErrors.transaction_date}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this transaction..."
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                formErrors.notes ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {formErrors.notes && (
              <p className="mt-1 text-sm text-red-600">{formErrors.notes}</p>
            )}
          </div>

          {/* Form Actions - Normal on desktop, hidden on mobile (replaced by sticky bar) */}
          <div className="hidden sm:flex justify-end sm:space-x-3 pt-4">
            <button
              onClick={handleCancel}
              className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>

      {/* Sticky mobile action bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            onClick={(e) => {
              // Find the form and submit it
              const form = e.currentTarget.closest('.space-y-6')?.querySelector('form') as HTMLFormElement
              if (form) {
                form.requestSubmit()
              }
            }}
            className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>

      {/* Add bottom padding to account for sticky bar on mobile */}
      <div className="sm:hidden h-20"></div>
    </div>
  )
}
