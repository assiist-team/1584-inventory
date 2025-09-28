import { ArrowLeft, Save, X, Bookmark, RotateCcw, Printer } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useState, FormEvent, useEffect } from 'react'
import { itemService } from '@/services/inventoryService'
import { TRANSACTION_SOURCES } from '@/constants/transactionSources'

export default function EditItem() {
  const { id: projectId, itemId } = useParams<{ id: string; itemId: string }>()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    description: '',
    source: '',
    sku: '',
    price: '',
    resale_price: '',
    market_value: '',
    payment_method: '',
    disposition: '',
    notes: '',
    bookmark: false,
    qr_key: ''
  })

  const [isCustomSource, setIsCustomSource] = useState(false)
  const [isCustomPaymentMethod, setIsCustomPaymentMethod] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  console.log('EditItem - URL params:', { projectId, itemId })

  // Initialize custom states based on form data
  useEffect(() => {
    const predefinedSources = TRANSACTION_SOURCES
    if (formData.source && !predefinedSources.includes(formData.source as any)) {
      setIsCustomSource(true)
    } else if (formData.source && predefinedSources.includes(formData.source as any)) {
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

  // Load item data
  useEffect(() => {
    const fetchItem = async () => {
      console.log('fetchItem called with:', { projectId, itemId })
      if (itemId && projectId) {
        try {
          const fetchedItem = await itemService.getItem(projectId, itemId)
          console.log('Fetched item data:', fetchedItem)
          if (fetchedItem) {
            setFormData({
              description: String(fetchedItem.description || ''),
              source: String(fetchedItem.source || ''),
              sku: String(fetchedItem.sku || ''),
              price: String(fetchedItem.price || ''),
              resale_price: String(fetchedItem.resale_price || ''),
              market_value: String(fetchedItem.market_value || ''),
              payment_method: String(fetchedItem.payment_method || ''),
              disposition: String(fetchedItem.disposition || ''),
              notes: String(fetchedItem.notes || ''),
              bookmark: Boolean(fetchedItem.bookmark || false),
              qr_key: String(fetchedItem.qr_key || '')
            })
            console.log('Form data set:', {
              description: String(fetchedItem.description || ''),
              source: String(fetchedItem.source || ''),
              sku: String(fetchedItem.sku || ''),
              price: String(fetchedItem.price || ''),
              resale_price: String(fetchedItem.resale_price || ''),
              market_value: String(fetchedItem.market_value || ''),
              payment_method: String(fetchedItem.payment_method || ''),
              disposition: String(fetchedItem.disposition || ''),
              notes: String(fetchedItem.notes || ''),
              bookmark: Boolean(fetchedItem.bookmark || false),
              qr_key: String(fetchedItem.qr_key || '')
            })
          }
        } catch (error) {
          console.error('Failed to fetch item:', error)
          setErrors({ fetch: 'Failed to load item data' })
        }
      }
      setLoading(false)
    }

    fetchItem()
  }, [itemId, projectId])

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

    if (!validateForm() || !itemId || !projectId) return

    setSaving(true)

    try {
      const itemData = {
        ...formData,
        last_updated: new Date().toISOString()
      }

      await itemService.updateItem(projectId, itemId, itemData)
      navigate(`/project/${projectId}?tab=inventory`)
    } catch (error) {
      console.error('Error updating item:', error)
      setErrors({ submit: 'Failed to update item. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    console.log('Updating field:', field, 'with value:', value)
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      console.log('New form data:', newData)
      return newData
    })

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const toggleBookmark = async () => {
    if (!itemId || !projectId) return

    try {
      await itemService.updateItem(projectId, itemId, {
        bookmark: !formData.bookmark
      })
      setFormData(prev => ({ ...prev, bookmark: !prev.bookmark }))
    } catch (error) {
      console.error('Failed to update bookmark:', error)
    }
  }

  const toggleDisposition = async () => {
    if (!itemId || !projectId) return

    try {
      // Toggle between 'keep' and 'return' (the two most common states)
      const newDisposition = formData.disposition === 'return' ? 'keep' : 'return'
      await itemService.updateItem(projectId, itemId, {
        disposition: newDisposition
      })
      setFormData(prev => ({ ...prev, disposition: newDisposition }))
    } catch (error) {
      console.error('Failed to update disposition:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
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
                to={`/project/${projectId}/item/${itemId}`}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                View Item
              </Link>
            </div>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Edit Item</h1>
          </div>
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-300 rounded w-2/3"></div>
            </div>
          </div>
        </div>
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
            to={`/project/${projectId}?tab=inventory`}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
          <div className="flex items-center space-x-3">
            <Link
              to={`/project/${projectId}/item/${itemId}`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              View Item
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Edit Item</h1>
        </div>
        <div className="p-8">
          <div className="flex space-x-2 mb-8">
            <button
              onClick={toggleBookmark}
              className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                formData.bookmark
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <Bookmark className="h-4 w-4 mr-2" fill={formData.bookmark ? 'currentColor' : 'none'} />
              {formData.bookmark ? 'Bookmarked' : 'Bookmark'}
            </button>

            <button
              onClick={toggleDisposition}
              className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                formData.disposition === 'return'
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {formData.disposition === 'return' ? 'Return' : 'Keep'}
            </button>

            <button
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => window.open(`/qr-image/${formData.qr_key}`, '_blank')}
            >
              <Printer className="h-4 w-4 mr-2" />
              QR
            </button>
          </div>

          <div className="px-6 py-4">
            <form onSubmit={handleSubmit} className="space-y-8">
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

              {/* Market Value */}
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
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
