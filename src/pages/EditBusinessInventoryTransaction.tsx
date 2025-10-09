import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Transaction, Project } from '@/types'
import { transactionService, projectService } from '@/services/inventoryService'
import { toDateOnlyString } from '@/utils/dateUtils'

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
    reimbursement_type: 'Client Owes' as 'Client Owes' | 'We Owe',
    trigger_event: 'Manual' as 'Inventory allocation' | 'Inventory return' | 'Inventory sale' | 'Purchase from client' | 'Manual',
    receipt_emailed: false
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Navigation context logic
  const backDestination = useMemo(() => {
    // Check if we have a returnTo parameter
    const searchParams = new URLSearchParams(location.search)
    const returnTo = searchParams.get('returnTo')
    if (returnTo) return returnTo

    // Default fallback
    return '/business-inventory'
  }, [location.search])

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
          setFormData({
            project_id: transactionData.project_id || '',
            transaction_date: toDateOnlyString(transactionData.transaction_date) || '',
            source: transactionData.source,
            transaction_type: transactionData.transaction_type,
            payment_method: transactionData.payment_method,
            amount: transactionData.amount,
            budget_category: transactionData.budget_category || 'Furnishings',
            notes: transactionData.notes || '',
            status: transactionData.status || 'pending',
            reimbursement_type: transactionData.reimbursement_type || 'Client Owes',
            trigger_event: transactionData.trigger_event || 'Manual',
            receipt_emailed: transactionData.receipt_emailed
          })
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
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.project_id) {
      errors.project_id = 'Project selection is required'
    }

    // Transaction date is optional

    if (!formData.source.trim()) {
      errors.source = 'Source is required'
    }

    if (!formData.amount.trim()) {
      errors.amount = 'Amount is required'
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
        project_id: actualProjectId
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Link
                to={backDestination}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Business Inventory Transaction</h1>
                <p className="text-sm text-gray-600">Update transaction details and information</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Project Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="project_id" className="block text-sm font-medium text-gray-700">
                    Project *
                  </label>
                  <select
                    id="project_id"
                    value={formData.project_id}
                    onChange={(e) => handleInputChange('project_id', e.target.value)}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      formErrors.project_id ? 'border-red-300' : ''
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

                <div>
                  <label htmlFor="transaction_date" className="block text-sm font-medium text-gray-700">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    id="transaction_date"
                    value={formData.transaction_date}
                    onChange={(e) => handleInputChange('transaction_date', e.target.value)}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      formErrors.transaction_date ? 'border-red-300' : ''
                    }`}
                  />
                  {formErrors.transaction_date && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.transaction_date}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="source" className="block text-sm font-medium text-gray-700">
                    Source *
                  </label>
                  <input
                    type="text"
                    id="source"
                    value={formData.source}
                    onChange={(e) => handleInputChange('source', e.target.value)}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      formErrors.source ? 'border-red-300' : ''
                    }`}
                    placeholder="e.g., Inventory Allocation, Client Purchase"
                  />
                  {formErrors.source && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.source}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="amount"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      formErrors.amount ? 'border-red-300' : ''
                    }`}
                    placeholder="0.00"
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="budget_category" className="block text-sm font-medium text-gray-700">
                    Budget Category
                  </label>
                  <select
                    id="budget_category"
                    value={formData.budget_category}
                    onChange={(e) => handleInputChange('budget_category', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="Furnishings">Furnishings</option>
                    <option value="Design Fee">Design Fee</option>
                    <option value="Property Management">Property Management</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Install">Install</option>
                    <option value="Storage & Receiving">Storage & Receiving</option>
                    <option value="Fuel">Fuel</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reimbursement_type" className="block text-sm font-medium text-gray-700">
                    Reimbursement Type
                  </label>
                  <select
                    id="reimbursement_type"
                    value={formData.reimbursement_type}
                    onChange={(e) => handleInputChange('reimbursement_type', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="Client owes us">Client owes us</option>
                    <option value="We owe client">We owe client</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Additional notes about this transaction..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="receipt_emailed"
                    checked={formData.receipt_emailed}
                    onChange={(e) => handleInputChange('receipt_emailed', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="receipt_emailed" className="ml-2 block text-sm text-gray-700">
                    Receipt emailed to client
                  </label>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {formErrors.general && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{formErrors.general}</div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Updating Transaction...' : 'Update Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
