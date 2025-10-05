import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BusinessInventoryItem } from '@/types'
import { businessInventoryService } from '@/services/inventoryService'

export default function AddBusinessInventoryItem() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
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
    inventory_status: 'available' as const
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

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

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const newItem: Omit<BusinessInventoryItem, 'item_id' | 'date_created' | 'last_updated'> = {
        ...formData,
        qr_key: `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      }

      const itemId = await businessInventoryService.createBusinessInventoryItem(newItem)
      navigate(`/business-inventory/${itemId}`)
    } catch (error) {
      console.error('Error creating item:', error)
      setFormErrors({ general: 'Error creating item. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/business-inventory')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Link
                to="/business-inventory"
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Add Business Inventory Item</h1>
                <p className="text-sm text-gray-600">Add a new item to your business inventory</p>
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
                {isSubmitting ? 'Adding Item...' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
