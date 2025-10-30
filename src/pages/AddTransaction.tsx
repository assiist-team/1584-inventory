import { ArrowLeft, Save, X } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useState, FormEvent, useEffect } from 'react'
import { TransactionFormData, TransactionValidationErrors, TransactionItemFormData, ItemImage, TaxPreset } from '@/types'
import { TRANSACTION_SOURCES } from '@/constants/transactionSources'
import { transactionService, projectService } from '@/services/inventoryService'
import { unifiedItemsService } from '@/services/inventoryService'
import { ImageUploadService, UploadProgress } from '@/services/imageService'
import ImageUpload from '@/components/ui/ImageUpload'
import TransactionItemsList from '@/components/TransactionItemsList'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { Shield } from 'lucide-react'
import { getTaxPresets } from '@/services/taxPresetsService'

export default function AddTransaction() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  // Check if user has permission to add transactions (DESIGNER role or higher)
  if (!hasRole(UserRole.DESIGNER)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to add transactions. Please contact an administrator if you need access.
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

  // Fetch project name
  useEffect(() => {
    const fetchProject = async () => {
      if (projectId) {
        try {
          const project = await projectService.getProject(projectId)
          if (project) {
            setProjectName(project.name)
          }
        } catch (error) {
          console.error('Failed to fetch project:', error)
        }
      }
    }

    fetchProject()
  }, [projectId])

  const [formData, setFormData] = useState<TransactionFormData>({
    transaction_date: (() => {
      const today = new Date()
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    })(), // YYYY-MM-DD format
    source: '',
    transaction_type: 'Purchase',
    payment_method: '',
    amount: '',
    budget_category: 'Furnishings',
    notes: '',
    status: 'completed',
    reimbursement_type: '',
    trigger_event: 'Manual',
    transaction_images: [], // Legacy field for backward compatibility
    receipt_images: [],
    other_images: [],
    items: []
  })

  // Tax form state
  const [taxRatePreset, setTaxRatePreset] = useState<string | undefined>(undefined)
  const [subtotal, setSubtotal] = useState<string>('')
  const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([])
  const [selectedPresetRate, setSelectedPresetRate] = useState<number | undefined>(undefined)

  const [items, setItems] = useState<TransactionItemFormData[]>([])
  const [imageFilesMap, setImageFilesMap] = useState<Map<string, File[]>>(new Map())

  const [isCustomSource, setIsCustomSource] = useState(false)

  // Initialize custom source state based on initial form data
  useEffect(() => {
    if (formData.source && !TRANSACTION_SOURCES.includes(formData.source as any)) {
      setIsCustomSource(true)
    } else if (formData.source && TRANSACTION_SOURCES.includes(formData.source as any)) {
      setIsCustomSource(false)
    }
  }, [formData.source])

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
  }, [taxRatePreset, taxPresets])

  const [errors, setErrors] = useState<TransactionValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: TransactionValidationErrors = {}

    if (!formData.source.trim()) {
      newErrors.source = 'Source is required'
    }

    // Transaction type is optional
    // Payment method is optional

    if (!formData.budget_category?.trim()) {
      newErrors.budget_category = 'Budget category is required'
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required'
    } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number'
    }

    // Tax validation for Other
    if (taxRatePreset === 'Other') {
      if (!subtotal.trim() || isNaN(Number(subtotal)) || Number(subtotal) <= 0) {
        newErrors.general = 'Subtotal must be provided and greater than 0 when Tax Rate Preset is Other.'
      } else if (Number(formData.amount) < Number(subtotal)) {
        newErrors.general = 'Subtotal cannot exceed the total amount.'
      }
    }

    // Items are now optional - no validation required
    // Transaction date is optional

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !projectId) return

    setIsSubmitting(true)

    try {
      // Create transaction data, excluding image File objects from formData since they contain File objects
      const { transaction_images, receipt_images, other_images, ...formDataWithoutImages } = formData

      const transactionData = {
        ...formDataWithoutImages,
        project_id: projectId,
        project_name: projectName,
        created_by: 'system',
        tax_rate_preset: taxRatePreset,
        receipt_emailed: formData.receipt_emailed ?? false,
        subtotal: taxRatePreset === 'Other' ? subtotal : ''
      }

      console.log('Attempting to create transaction with data:', transactionData)
      console.log('Transaction date value:', transactionData.transaction_date)
      console.log('Transaction date type:', typeof transactionData.transaction_date)
      console.log('Transaction items:', items)

      // Create transaction with items first to get the real transaction ID
      const transactionId = await transactionService.createTransaction(projectId, transactionData, items)

      // Now upload receipt images using the real transaction ID
      if (formData.receipt_images && formData.receipt_images.length > 0) {
        setIsUploadingImages(true)

        try {
          const uploadResults = await ImageUploadService.uploadMultipleReceiptImages(
            formData.receipt_images,
            projectName,
            transactionId,
            handleImageUploadProgress
          )

          // Convert to TransactionImage format
          const receiptImages = ImageUploadService.convertFilesToReceiptImages(uploadResults)
          console.log('Receipt images uploaded successfully:', receiptImages.length, 'images')
          console.log('Receipt images to save:', receiptImages)

          // Update the transaction with the uploaded receipt images
          if (receiptImages && receiptImages.length > 0) {
            console.log('Updating transaction with receipt images...')
            try {
              await transactionService.updateTransaction(projectId, transactionId, {
                receipt_images: receiptImages
              })
              console.log('Transaction updated successfully with receipt images')
            } catch (updateError) {
              console.error('Failed to update transaction with receipt images:', updateError)
              // Don't fail the entire transaction if image update fails
            }
          }

          // Small delay to ensure the update is processed before continuing
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error: any) {
          console.error('Error uploading receipt images:', error)

          // Provide specific error messages based on error type
          let errorMessage = 'Failed to upload receipt images. Please try again.'
          if (error.message?.includes('Storage service is not available')) {
            errorMessage = 'Storage service is unavailable. Please check your internet connection.'
          } else if (error.message?.includes('Network error') || error.message?.includes('offline')) {
            errorMessage = 'Network connection issue. Please check your internet and try again.'
          } else if (error.message?.includes('quota exceeded')) {
            errorMessage = 'Storage quota exceeded. Please contact support.'
          } else if (error.message?.includes('Unauthorized')) {
            errorMessage = 'Permission denied. Please check your account permissions.'
          } else if (error.message?.includes('CORS') || error.message?.includes('Access-Control') || error.message?.includes('ERR_FAILED') || error.message?.includes('preflight')) {
            errorMessage = 'Upload blocked by browser security policy. Please check Firebase Storage configuration or try refreshing the page.'
          }

          setErrors({ receipt_images: errorMessage })
          setIsSubmitting(false)
          setIsUploadingImages(false)
          return
        }

        setIsUploadingImages(false)
      }

      // Now upload other images using the real transaction ID
      if (formData.other_images && formData.other_images.length > 0) {
        setIsUploadingImages(true)

        try {
          const uploadResults = await ImageUploadService.uploadMultipleOtherImages(
            formData.other_images,
            projectName,
            transactionId,
            handleImageUploadProgress
          )

          // Convert to TransactionImage format
          const otherImages = ImageUploadService.convertFilesToOtherImages(uploadResults)
          console.log('Other images uploaded successfully:', otherImages.length, 'images')
          console.log('Other images to save:', otherImages)

          // Update the transaction with the uploaded other images
          if (otherImages && otherImages.length > 0) {
            console.log('Updating transaction with other images...')
            try {
              await transactionService.updateTransaction(projectId, transactionId, {
                other_images: otherImages
              })
              console.log('Transaction updated successfully with other images')
            } catch (updateError) {
              console.error('Failed to update transaction with other images:', updateError)
              // Don't fail the entire transaction if image update fails
            }
          }

          // Small delay to ensure the update is processed before continuing
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error: any) {
          console.error('Error uploading other images:', error)

          // Provide specific error messages based on error type
          let errorMessage = 'Failed to upload other images. Please try again.'
          if (error.message?.includes('Storage service is not available')) {
            errorMessage = 'Storage service is unavailable. Please check your internet connection.'
          } else if (error.message?.includes('Network error') || error.message?.includes('offline')) {
            errorMessage = 'Network connection issue. Please check your internet and try again.'
          } else if (error.message?.includes('quota exceeded')) {
            errorMessage = 'Storage quota exceeded. Please contact support.'
          } else if (error.message?.includes('Unauthorized')) {
            errorMessage = 'Permission denied. Please check your account permissions.'
          } else if (error.message?.includes('CORS') || error.message?.includes('Access-Control') || error.message?.includes('ERR_FAILED') || error.message?.includes('preflight')) {
            errorMessage = 'Upload blocked by browser security policy. Please check Firebase Storage configuration or try refreshing the page.'
          }

          setErrors({ other_images: errorMessage })
          setIsSubmitting(false)
          setIsUploadingImages(false)
          return
        }

        setIsUploadingImages(false)
      }

      // Upload item images with the correct item IDs
      if (imageFilesMap.size > 0) {
        try {
          console.log('Starting image upload process...')
          // Get the created items and extract their IDs
          const createdItems = await unifiedItemsService.getItemsForTransaction(projectId, transactionId)
          const createdItemIds = createdItems.map(item => item.item_id)
          console.log('Created item IDs:', createdItemIds)

          // Upload images for each item
          for (let i = 0; i < items.length && i < createdItemIds.length; i++) {
            const item = items[i]
            const itemId = createdItemIds[i]
            const imageFiles = imageFilesMap.get(item.id)

            if (imageFiles && imageFiles.length > 0) {
              console.log(`Uploading ${imageFiles.length} images for item ${itemId}`)

              // Upload each image file with the final item ID
              const uploadPromises = imageFiles.map(async (file, fileIndex) => {
                try {
                  console.log(`Uploading file ${fileIndex + 1}/${imageFiles.length}: ${file.name}`)
                  const uploadResult = await ImageUploadService.uploadItemImage(
                    file,
                    projectName,
                    itemId
                  )
                  console.log(`Upload successful for ${file.name}:`, uploadResult)
                  console.log(`Upload result URL: ${uploadResult.url}`)

                  const uploadedImage: ItemImage = {
                    url: uploadResult.url,
                    alt: file.name,
                    isPrimary: item.images?.find(img => img.fileName === file.name)?.isPrimary || false,
                    uploadedAt: new Date(),
                    fileName: file.name,
                    size: file.size,
                    mimeType: file.type
                  }
                  console.log('Created ItemImage object:', uploadedImage)
                  return uploadedImage
                } catch (uploadError) {
                  console.error(`Failed to upload ${file.name}:`, uploadError)
                  // Return a placeholder image object so the process continues
                  return {
                    url: '',
                    alt: file.name,
                    isPrimary: false,
                    uploadedAt: new Date(),
                    fileName: file.name,
                    size: file.size,
                    mimeType: file.type
                  } as ItemImage
                }
              })

              const uploadedImages = await Promise.all(uploadPromises)
              console.log('All uploads completed, updating item with images:', uploadedImages)

              // Filter out any failed uploads (empty URLs)
              const validImages = uploadedImages.filter(img => img.url && img.url.trim() !== '')
              console.log(`Valid images to save: ${validImages.length}/${uploadedImages.length}`)

              if (validImages.length > 0) {
                // Update the item with the uploaded images
                await unifiedItemsService.updateItem(itemId, { images: validImages })
                console.log(`Successfully updated item ${itemId} with ${validImages.length} images`)
              }
            }
          }
        } catch (imageError) {
          console.error('Error in image upload process:', imageError)
          // Don't fail the transaction if image upload fails - just log the error
          // The transaction was successfully created, items just won't have images
        }
      }

      navigate(`/project/${projectId}?tab=transactions`)
    } catch (error) {
      console.error('Error creating transaction:', error)
      setErrors({ general: error instanceof Error ? error.message : 'Failed to create transaction. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: Exclude<keyof TransactionFormData, 'tax_rate_preset' | 'subtotal'>, value: string | boolean | File[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleReceiptImagesChange = (files: File[]) => {
    setFormData(prev => ({ ...prev, receipt_images: files }))
    // Clear any existing image errors
    if (errors.receipt_images) {
      setErrors(prev => ({ ...prev, receipt_images: undefined }))
    }
  }

  const handleOtherImagesChange = (files: File[]) => {
    setFormData(prev => ({ ...prev, other_images: files }))
    // Clear any existing image errors
    if (errors.other_images) {
      setErrors(prev => ({ ...prev, other_images: undefined }))
    }
  }

  const handleImageFilesChange = (itemId: string, imageFiles: File[]) => {
    // Update the imageFilesMap
    setImageFilesMap(prev => {
      const newMap = new Map(prev)
      newMap.set(itemId, imageFiles)
      return newMap
    })

    // Also update the item in the items array with the imageFiles
    setItems(prevItems => prevItems.map(item =>
      item.id === itemId
        ? { ...item, imageFiles }
        : item
    ))
  }

  const handleImageUploadProgress = (fileIndex: number, progress: UploadProgress) => {
    // Progress tracking removed to fix TypeScript errors
    console.log(`Upload progress for file ${fileIndex}: ${progress.percentage}%`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Back button row */}
        <div className="flex items-center justify-between">
          <Link
            to={`/project/${projectId}?tab=transactions`}
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
          <h1 className="text-2xl font-bold text-gray-900">Add Transaction</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-8 p-8">
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

          {/* Transaction Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Transaction Source *
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

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Transaction Type
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

          {/* Transaction Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Transaction Method
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
            {errors.reimbursement_type && (
              <p className="mt-1 text-sm text-red-600">{errors.reimbursement_type}</p>
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
                  errors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
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

          {/* Transaction Items */}
          <div>
            <TransactionItemsList
              items={items}
              onItemsChange={(newItems) => {
                setItems(newItems)
                // Clear items error if items are added
                if (errors.items && newItems.length > 0) {
                  setErrors(prev => ({ ...prev, items: undefined }))
                }
              }}
              projectId={projectId}
              projectName={projectName}
              onImageFilesChange={handleImageFilesChange}
            />
            {errors.items && (
              <p className="mt-1 text-sm text-red-600">{errors.items}</p>
            )}
          </div>

          {/* Receipt Images */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Receipt Images
            </h3>
            <ImageUpload
              onImagesChange={handleReceiptImagesChange}
              maxImages={5}
              maxFileSize={10}
              disabled={isSubmitting || isUploadingImages}
              className="mb-2"
            />
            {errors.receipt_images && (
              <p className="mt-1 text-sm text-red-600">{errors.receipt_images}</p>
            )}
          </div>

          {/* Other Images */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Other Images
            </h3>
            <ImageUpload
              onImagesChange={handleOtherImagesChange}
              maxImages={5}
              maxFileSize={10}
              disabled={isSubmitting || isUploadingImages}
              className="mb-2"
            />
            {errors.other_images && (
              <p className="mt-1 text-sm text-red-600">{errors.other_images}</p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Link
              to={`/project/${projectId}?tab=transactions`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImages}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : isUploadingImages ? 'Uploading Images...' : 'Create Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
