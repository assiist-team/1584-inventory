import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, X } from 'lucide-react'
import { BusinessInventoryItem } from '@/types'
import { businessInventoryService } from '@/services/inventoryService'

export default function EditBusinessInventoryItem() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [item, setItem] = useState<BusinessInventoryItem | null>(null)
  const [formData, setFormData] = useState({
    description: '',
    source: '',
    sku: '',
    price: '',
    market_value: '',
    payment_method: '',
    disposition: 'keep',
    notes: '',
    space: '',
    bookmark: false,
    business_inventory_location: '',
    inventory_status: 'available' as 'available' | 'pending' | 'sold'
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (id) {
      loadItem()
    }
  }, [id])

  const loadItem = async () => {
    if (!id) return

    try {
      const itemData = await businessInventoryService.getBusinessInventoryItem(id)
      if (itemData) {
        setItem(itemData)
        setFormData({
          description: itemData.description,
          source: itemData.source,
          sku: itemData.sku,
          price: itemData.price,
          market_value: itemData.market_value || '',
          payment_method: itemData.payment_method,
          disposition: itemData.disposition || 'keep',
          notes: itemData.notes || '',
          space: itemData.space || '',
          bookmark: itemData.bookmark,
          business_inventory_location: itemData.business_inventory_location || '',
          inventory_status: itemData.inventory_status
        })
      }
    } catch (error) {
      console.error('Error loading item:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.description.trim()) {
      errors.description = 'Description is required'
    }

    if (!formData.source.trim()) {
      errors.source = 'Source is required'
    }

    if (!formData.price.trim()) {
      errors.price = 'Price is required'
    }

    if (!formData.business_inventory_location.trim()) {
      errors.business_inventory_location = 'Location is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!id || !validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      await businessInventoryService.updateBusinessInventoryItem(id, formData)
      navigate(`/business-inventory/${id}`)
    } catch (error) {
      console.error('Error updating item:', error)
      setFormErrors({ general: 'Error updating item. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate(`/business-inventory/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-12 px-4">
        <div className="mx-auto h-16 w-16 text-gray-400 -mb-1">📦</div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          Item not found
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          The item you're looking for doesn't exist or has been deleted.
        </p>
        <Link
          to="/business-inventory"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          Back to Inventory
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
                to={`/business-inventory/${id}`}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Business Inventory Item</h1>
                <p className="text-sm text-gray-600">Update item details and information</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">General Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <input
                    type="text"
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      formErrors.description ? 'border-red-300' : ''
                    }`}
                    placeholder="e.g., Vintage leather armchair"
                  />
                  {formErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                  )}
                </div>

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
                    placeholder="e.g., purchased, found, donated"
                  />
                  {formErrors.source && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.source}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                    SKU
                  </label>
                  <input
                    type="text"
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="e.g., CHR-001"
                  />
                </div>

                <div>
                  <label htmlFor="business_inventory_location" className="block text-sm font-medium text-gray-700">
                    Storage Location *
                  </label>
                  <input
                    type="text"
                    id="business_inventory_location"
                    value={formData.business_inventory_location}
                    onChange={(e) => handleInputChange('business_inventory_location', e.target.value)}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      formErrors.business_inventory_location ? 'border-red-300' : ''
                    }`}
                    placeholder="e.g., Warehouse A - Section 3 - Shelf 5"
                  />
                  {formErrors.business_inventory_location && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.business_inventory_location}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    Purchase Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="price"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      formErrors.price ? 'border-red-300' : ''
                    }`}
                    placeholder="0.00"
                  />
                  {formErrors.price && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.price}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="market_value" className="block text-sm font-medium text-gray-700">
                    Market Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="market_value"
                    value={formData.market_value}
                    onChange={(e) => handleInputChange('market_value', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700">
                    Payment Method
                  </label>
                  <select
                    id="payment_method"
                    value={formData.payment_method}
                    onChange={(e) => handleInputChange('payment_method', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="">Select payment method</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="check">Check</option>
                    <option value="bank transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="space" className="block text-sm font-medium text-gray-700">
                    Space/Location (Optional)
                  </label>
                  <input
                    type="text"
                    id="space"
                    value={formData.space}
                    onChange={(e) => handleInputChange('space', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="e.g., Living Room, Bedroom, Office"
                  />
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Additional notes about this item..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="bookmark"
                    checked={formData.bookmark}
                    onChange={(e) => handleInputChange('bookmark', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="bookmark" className="ml-2 block text-sm text-gray-700">
                    Bookmark this item
                  </label>
                </div>
              </div>
            </div>

            {/* Inventory Status */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Status</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="inventory_status" className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    id="inventory_status"
                    value={formData.inventory_status}
                    onChange={(e) => handleInputChange('inventory_status', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="available">Available</option>
                    <option value="pending">Allocated</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>
              </div>
              {item.current_project_id && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This item is currently allocated to project {item.current_project_id}.
                    Changing the status may affect the pending transaction.
                  </p>
                </div>
              )}
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
                {isSubmitting ? 'Updating Item...' : 'Update Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
