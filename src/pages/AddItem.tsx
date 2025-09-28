import { ArrowLeft, Save, X } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useState, FormEvent, useEffect } from 'react'
import { itemService } from '@/services/inventoryService'
import { TRANSACTION_SOURCES, TransactionSource } from '@/constants/transactionSources'

export default function AddItem() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [formData, setFormData] = useState<{
    description: string
    source: string
    sku: string
    price: string
    resale_price: string
    market_value: string
    payment_method: string
    disposition: string
    notes: string
  }>({
    description: '',
    source: '',
    sku: '',
    price: '',
    resale_price: '',
    market_value: '',
    payment_method: '',
    disposition: '',
    notes: ''
  })

  const [isCustomSource, setIsCustomSource] = useState(false)
  const [isCustomPaymentMethod, setIsCustomPaymentMethod] = useState(false)

  // Initialize custom states based on initial form data
  useEffect(() => {
    const predefinedSources = TRANSACTION_SOURCES
    if (formData.source && !predefinedSources.includes(formData.source as TransactionSource)) {
      setIsCustomSource(true)
    } else if (formData.source && predefinedSources.includes(formData.source as TransactionSource)) {
      setIsCustomSource(false)
    }
  }, [formData.source])

  useEffect(() => {
    const predefinedPaymentMethods = ['Client Card', '1584 Card', 'Split', 'Store Credit']
    if (formData.payment_method && !predefinedPaymentMethods.includes(formData.payment_method)) {
      setIsCustomPaymentMethod(true)
    } else if (formData.payment_method && predefinedPaymentMethods.includes(formData.payment_method)) {
      setIsCustomPaymentMethod(false)
    }
  }, [formData.payment_method])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (!formData.source.trim()) {
      newErrors.source = 'Source is required'
    }

    if (!formData.payment_method.trim()) {
      newErrors.payment_method = 'Payment method is required'
    }

    if (!formData.disposition.trim()) {
      newErrors.disposition = 'Disposition is required'
    }

    if (!formData.price.trim()) {
      newErrors.price = 'Price is required'
    } else if (isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      newErrors.price = 'Price must be a positive number'
    }

    // Validate market value if provided
    if (formData.market_value.trim() && (isNaN(Number(formData.market_value)) || Number(formData.market_value) <= 0)) {
      newErrors.market_value = 'Market value must be a positive number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !projectId) return

    setIsSubmitting(true)

    try {
      const itemData = {
        ...formData,
        project_id: projectId,
        qr_key: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        bookmark: false,
        transaction_id: '', // This would be set when creating items from transactions
        date_created: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }

      await itemService.createItem(projectId, itemData)
      navigate(`/project/${projectId}?tab=inventory`)
    } catch (error) {
      console.error('Error creating item:', error)
      setErrors({ submit: 'Failed to create item. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Back button row */}
        <div className="flex items-center justify-between">
          <Link
            to={`/project/${projectId}?tab=inventory`}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
          <div className="flex items-center space-x-3">
            <Link
              to={`/project/${projectId}?tab=transactions`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              View Transactions
            </Link>
          </div>
        </div>

      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Add Item</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-8 p-8">
          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <input
              type="text"
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="e.g., Wooden dining table, 6 chairs"
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Source *
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
                  errors.source ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            )}
            {errors.source && (
              <p className="mt-1 text-sm text-red-600">{errors.source}</p>
            )}
          </div>

          {/* SKU */}
          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
              SKU
            </label>
            <input
              type="text"
              id="sku"
              value={formData.sku}
              onChange={(e) => handleInputChange('sku', e.target.value)}
              placeholder="Product SKU or model number"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Price and Market Value */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                Purchase Price *
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="text"
                  id="price"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="0.00"
                  className={`block w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                    errors.price ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.price && (
                <p className="mt-1 text-sm text-red-600">{errors.price}</p>
              )}
            </div>

            <div>
              <label htmlFor="market_value" className="block text-sm font-medium text-gray-700">
                Market Value
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="text"
                  id="market_value"
                  value={formData.market_value}
                  onChange={(e) => handleInputChange('market_value', e.target.value)}
                  placeholder="0.00"
                  className={`block w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                    errors.market_value ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.market_value && (
                <p className="mt-1 text-sm text-red-600">{errors.market_value}</p>
              )}
            </div>
          </div>

          {/* 1584 Resale Price */}
          <div>
            <label htmlFor="resale_price" className="block text-sm font-medium text-gray-700">
              1584 Resale Price
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                id="resale_price"
                value={formData.resale_price}
                onChange={(e) => handleInputChange('resale_price', e.target.value)}
                placeholder="0.00"
                className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Payment Method *
            </label>
            <div className="flex items-center space-x-6 mb-3">
              {['Client Card', '1584 Card', 'Split', 'Store Credit'].map((method) => (
                <div key={method} className="flex items-center">
                  <input
                    type="radio"
                    id={`payment_${method.toLowerCase().replace(/\s+/g, '_')}`}
                    name="payment_method"
                    value={method}
                    checked={formData.payment_method === method}
                    onChange={(e) => {
                      handleInputChange('payment_method', e.target.value)
                      setIsCustomPaymentMethod(false)
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <label htmlFor={`payment_${method.toLowerCase().replace(/\s+/g, '_')}`} className="ml-2 block text-sm text-gray-900">
                    {method}
                  </label>
                </div>
              ))}
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="payment_custom"
                name="payment_method"
                value="custom"
                checked={isCustomPaymentMethod}
                onChange={() => {
                  setIsCustomPaymentMethod(true)
                  handleInputChange('payment_method', '')
                }}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="payment_custom" className="ml-2 block text-sm text-gray-900">
                Other
              </label>
            </div>
            {isCustomPaymentMethod && (
              <input
                type="text"
                id="payment_custom_input"
                value={formData.payment_method}
                onChange={(e) => handleInputChange('payment_method', e.target.value)}
                placeholder="Enter custom payment method..."
                className={`mt-3 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                  errors.payment_method ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            )}
            {errors.payment_method && (
              <p className="mt-1 text-sm text-red-600">{errors.payment_method}</p>
            )}
          </div>

          {/* Disposition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Disposition *
            </label>
            <div className="flex items-center space-x-6">
              {['keep', 'return', '1584'].map((disposition) => (
                <div key={disposition} className="flex items-center">
                  <input
                    type="radio"
                    id={`disposition_${disposition.toLowerCase()}`}
                    name="disposition"
                    value={disposition}
                    checked={formData.disposition === disposition}
                    onChange={(e) => handleInputChange('disposition', e.target.value)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <label htmlFor={`disposition_${disposition.toLowerCase()}`} className="ml-2 block text-sm text-gray-900">
                    {disposition === '1584' ? '1584 Design' : disposition.charAt(0).toUpperCase() + disposition.slice(1)}
                  </label>
                </div>
              ))}
            </div>
            {errors.disposition && (
              <p className="mt-1 text-sm text-red-600">{errors.disposition}</p>
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
              placeholder="Additional notes about this item..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Error message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Link
              to={`/project/${projectId}?tab=inventory`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
