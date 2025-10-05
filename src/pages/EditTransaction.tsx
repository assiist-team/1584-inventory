import { ArrowLeft, Save, X } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, FormEvent } from 'react'
import { TransactionFormData, TransactionValidationErrors, TransactionImage, TransactionItemFormData } from '@/types'
import { TRANSACTION_SOURCES } from '@/constants/transactionSources'
import { transactionService, projectService, itemService } from '@/services/inventoryService'
import { ImageUploadService, UploadProgress } from '@/services/imageService'
import ImageUpload from '@/components/ui/ImageUpload'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { Shield } from 'lucide-react'

export default function EditTransaction() {
  const { id: projectId, transactionId } = useParams<{ id: string; transactionId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  // Check if user has permission to edit transactions (DESIGNER role or higher)
  if (!hasRole(UserRole.DESIGNER)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to edit transactions. Please contact an administrator if you need access.
          </p>
          <Link
            to={`/project/${projectId}`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Project
          </Link>
        </div>
      </div>
    )
  }

  const [projectName, setProjectName] = useState<string>('')

  const [formData, setFormData] = useState<TransactionFormData>({
    transaction_date: '',
    source: '',
    transaction_type: 'Purchase',
    payment_method: '',
    amount: '',
    budget_category: 'Furnishings',
    notes: '',
    receipt_images: [],
    other_images: [],
    receipt_emailed: false
  })

  const [errors, setErrors] = useState<TransactionValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [existingOtherImages, setExistingOtherImages] = useState<TransactionImage[]>([])

  // Transaction items state
  const [items, setItems] = useState<TransactionItemFormData[]>([])

  // Custom source state
  const [isCustomSource, setIsCustomSource] = useState(false)

  // Load transaction and project data
  useEffect(() => {
    const loadTransaction = async () => {
      if (!projectId || !transactionId) return

      try {
        const [transaction, project] = await Promise.all([
          transactionService.getTransaction(projectId, transactionId),
          projectService.getProject(projectId)
        ])

        if (project) {
          setProjectName(project.name)
        }
        if (transaction) {
          // Check if source is custom (not in predefined list)
          const sourceIsCustom = Boolean(transaction.source && !TRANSACTION_SOURCES.includes(transaction.source as any))

          // Use the transaction date directly for date input
          setFormData({
            transaction_date: transaction.transaction_date || '',
            source: transaction.source,
            transaction_type: transaction.transaction_type,
            payment_method: transaction.payment_method,
            amount: transaction.amount,
            budget_category: transaction.budget_category || 'Furnishings',
            notes: transaction.notes || '',
            receipt_images: [],
            other_images: [],
            receipt_emailed: transaction.receipt_emailed
          })

          setIsCustomSource(sourceIsCustom)

          // Handle legacy and new image fields for loading transaction data
          // Note: Legacy transaction_images is loaded but not stored in local state, receipt_images is the current field

          const otherImages = transaction.other_images || []
          setExistingOtherImages(Array.isArray(otherImages) ? otherImages : [])

          // Load transaction items
          try {
            const transactionItemIds = await itemService.getTransactionItems(projectId, transactionId)
            console.log('Loaded transaction item IDs:', transactionItemIds)

            const transactionItems = await Promise.all(
              transactionItemIds.map(async (itemId) => {
                const item = await itemService.getItem(projectId, itemId)
                console.log(`Loaded item ${itemId}:`, {
                  id: itemId,
                  description: item?.description || '',
                  hasValidFormat: itemId.startsWith('I-') && itemId.length > 10
                })

                return {
                  id: itemId,
                  description: item?.description || '',
                  price: item?.price?.toString() || '',
                  sku: item?.sku || '',
                  market_value: item?.market_value?.toString() || '',
                  notes: item?.notes || '',
                  imageFiles: [],
                  images: item?.images || []
                }
              })
            )
            console.log('Loaded transaction items:', transactionItems.map(item => ({
              id: item.id,
              description: item.description,
              isTempId: item.id.startsWith('temp-')
            })))
            setItems(transactionItems)
          } catch (itemError) {
            console.error('Error loading transaction items:', itemError)
          }
        }
      } catch (error) {
        console.error('Error loading transaction:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTransaction()
  }, [projectId, transactionId])

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: TransactionValidationErrors = {}

    if (!formData.source.trim()) {
      newErrors.source = 'Source is required'
    }

    if (!formData.transaction_type.trim()) {
      newErrors.transaction_type = 'Transaction type is required'
    }

    if (!formData.payment_method.trim()) {
      newErrors.payment_method = 'Payment method is required'
    }

    if (!formData.budget_category?.trim()) {
      newErrors.budget_category = 'Budget category is required'
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required'
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number'
    }

    if (!formData.transaction_date) {
      newErrors.transaction_date = 'Transaction date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !projectId || !transactionId) return

    setIsSubmitting(true)

    try {
      // First, handle item updates and creations
      if (items.length > 0) {
        // Debug: Log all items to understand the issue
        console.log('All items before processing:', items.map(item => ({
          id: item.id,
          description: item.description,
          price: item.price,
          sku: item.sku,
          isTempId: item.id.startsWith('temp-'),
          idFormat: item.id.startsWith('I-') ? 'database' : item.id.startsWith('temp-') ? 'temp' : 'unknown'
        })))
        // Separate existing items from new items using robust classification
        // Existing items have real database IDs (format: "I-" prefix followed by timestamp and random string)
        // New items have temporary IDs (format: "temp-" prefix followed by timestamp and random string)
        const existingItems: TransactionItemFormData[] = []
        const newItems: TransactionItemFormData[] = []

        items.forEach(item => {
          // Robust classification logic
          if (item.id.startsWith('temp-')) {
            // Definitely a temp item
            newItems.push(item)
          } else if (item.id.startsWith('I-') && item.id.length > 10) {
            // Likely a real database item (format: I-timestamp-randomstring)
            existingItems.push(item)
          } else if (item.id.length > 5 && !item.id.includes('_')) {
            // Could be a real database item with different format, treat as existing for safety
            console.warn(`Item with ambiguous ID treated as existing: ${item.id} - ${item.description}`)
            existingItems.push(item)
          } else {
            // Default to treating as new item if ID format is unclear
            console.warn(`Item with unclear ID format treated as new: ${item.id} - ${item.description}`)
            newItems.push(item)
          }
        })

        console.log(`Separated ${existingItems.length} existing items and ${newItems.length} new items`)

        // Update existing items (classification is now robust, so no additional safety checks needed)
        for (const item of existingItems) {
          await itemService.updateItem(projectId, item.id, {
            description: item.description,
            price: item.price,
            sku: item.sku,
            market_value: item.market_value,
            notes: item.notes,
            transaction_id: transactionId
          })
        }

        // Create new items using the same batch infrastructure as new transactions
        let createdItemIds: string[] = []
        if (newItems.length > 0) {
          createdItemIds = await itemService.createTransactionItems(
            projectId,
            transactionId,
            formData.transaction_date,
            formData.source,
            newItems
          )
          console.log('Created new items:', createdItemIds)

          // Update the item IDs in our local state (map temp IDs to real IDs)
          setItems(prevItems => prevItems.map(prevItem => {
            // Only update items that were in our newItems array (have temp IDs)
            const newItemIndex = newItems.findIndex(item => item.id === prevItem.id)
            if (newItemIndex >= 0 && newItemIndex < createdItemIds.length) {
              return { ...prevItem, id: createdItemIds[newItemIndex] }
            }
            return prevItem
          }))
        }

        // Note: Item image upload functionality removed for now - focusing on transaction images
      }

      // Upload other images
      let otherImages: TransactionImage[] = [...existingOtherImages]
      if (formData.other_images && formData.other_images.length > 0) {
        try {
          const uploadResults = await ImageUploadService.uploadMultipleOtherImages(
            formData.other_images,
            projectName,
            transactionId,
            handleImageUploadProgress
          )

          // Convert to TransactionImage format and combine with existing images
          const newOtherImages = ImageUploadService.convertFilesToOtherImages(uploadResults)
          otherImages = [...existingOtherImages, ...newOtherImages]
        } catch (error) {
          console.error('Error uploading other images:', error)
          setErrors({ other_images: 'Failed to upload other images. Please try again.' })
          setIsSubmitting(false)
          setIsUploadingImages(false)
          return
        }
      } else {
        // Use existing images if no new ones uploaded
        otherImages = existingOtherImages
      }

      // Update transaction with new data and images
      const { other_images, receipt_images, transaction_images, ...formDataWithoutImages } = formData
      const updateData = {
        ...formDataWithoutImages,
        other_images: otherImages
      }

      await transactionService.updateTransaction(projectId, transactionId, updateData)
      navigate(`/project/${projectId}/transaction/${transactionId}`)
    } catch (error) {
      console.error('Error updating transaction:', error)
      // Set a general error message instead of targeting specific fields
      setErrors({ general: error instanceof Error ? error.message : 'Failed to update transaction. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof TransactionFormData, value: string | boolean | File[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }


  const handleImageUploadProgress = (fileIndex: number, progress: UploadProgress) => {
    // Progress tracking removed to fix TypeScript errors
    console.log(`Upload progress for file ${fileIndex}: ${progress.percentage}%`)
  }



  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading transaction...</p>
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
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </button>
        </div>

      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Edit Transaction</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* General Error Display */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{errors.general}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  errors.source ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            )}
            {errors.source && (
              <p className="mt-1 text-sm text-red-600">{errors.source}</p>
            )}
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Transaction Type *
            </label>
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="type_purchase"
                  name="transaction_type"
                  value="Purchase"
                  checked={formData.transaction_type === 'Purchase'}
                  onChange={(e) => handleInputChange('transaction_type', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="type_purchase" className="ml-2 block text-sm text-gray-900">
                  Purchase
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="type_to_inventory"
                  name="transaction_type"
                  value="To Inventory"
                  checked={formData.transaction_type === 'To Inventory'}
                  onChange={(e) => handleInputChange('transaction_type', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="type_to_inventory" className="ml-2 block text-sm text-gray-900">
                  To Inventory
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="type_return"
                  name="transaction_type"
                  value="Return"
                  checked={formData.transaction_type === 'Return'}
                  onChange={(e) => handleInputChange('transaction_type', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="type_return" className="ml-2 block text-sm text-gray-900">
                  Return
                </label>
              </div>
            </div>
            {errors.transaction_type && (
              <p className="mt-1 text-sm text-red-600">{errors.transaction_type}</p>
            )}
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
                  errors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Payment Method *
            </label>
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="method_client_card"
                  name="payment_method"
                  value="Client Card"
                  checked={formData.payment_method === 'Client Card'}
                  onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="method_client_card" className="ml-2 block text-sm text-gray-900">
                  Client Card
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="method_1584_card"
                  name="payment_method"
                  value="1584 Design"
                  checked={formData.payment_method === '1584 Design'}
                  onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <label htmlFor="method_1584_card" className="ml-2 block text-sm text-gray-900">
                  1584 Design
                </label>
              </div>
            </div>
            {errors.payment_method && (
              <p className="mt-1 text-sm text-red-600">{errors.payment_method}</p>
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
            {errors.budget_category && (
              <p className="mt-1 text-sm text-red-600">{errors.budget_category}</p>
            )}
          </div>

          {/* Transaction Date */}
          <div>
            <label htmlFor="transaction_date" className="block text-sm font-medium text-gray-700">
              Transaction Date *
            </label>
            <input
              type="date"
              id="transaction_date"
              value={formData.transaction_date}
              onChange={(e) => {
                // Use the date value directly (YYYY-MM-DD format)
                handleInputChange('transaction_date', e.target.value)
              }}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                errors.transaction_date ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.transaction_date && (
              <p className="mt-1 text-sm text-red-600">{errors.transaction_date}</p>
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
                errors.notes ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
            )}
          </div>

          {/* Other Images */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Other Images
            </h3>
            <ImageUpload
              onImagesChange={(files) => handleInputChange('other_images', files)}
              maxImages={5}
              maxFileSize={10}
              disabled={isSubmitting || isUploadingImages}
              className="mb-2"
            />
            {errors.other_images && (
              <p className="mt-1 text-sm text-red-600">{errors.other_images}</p>
            )}
          </div>


          {/* Form Actions - Normal on desktop, hidden on mobile (replaced by sticky bar) */}
          <div className="hidden sm:flex justify-end sm:space-x-3 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImages}
              className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Updating...' : isUploadingImages ? 'Uploading Images...' : 'Update'}
            </button>
          </div>
        </form>
      </div>

      {/* Sticky mobile action bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="flex space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 inline-flex justify-center items-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isUploadingImages}
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
            {isSubmitting ? 'Updating...' : isUploadingImages ? 'Uploading Images...' : 'Update'}
          </button>
        </div>
      </div>

      {/* Add bottom padding to account for sticky bar on mobile */}
      <div className="sm:hidden h-20"></div>
    </div>
  )
}
