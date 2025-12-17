import { useState, useRef } from 'react'
import { X, DollarSign, Upload, Trash2 } from 'lucide-react'
import { ProjectBudgetCategories } from '@/types'
import { ImageUploadService } from '@/services/imageService'
import { projectService } from '@/services/inventoryService'
import { useAccount } from '@/contexts/AccountContext'

interface ProjectFormData {
  name: string;
  description: string;
  clientName: string;
  budget?: number;
  designFee?: number;
  budgetCategories?: ProjectBudgetCategories;
  mainImageUrl?: string;
}

interface ProjectFormProps {
  onSubmit: (data: ProjectFormData) => Promise<string | void>; // Returns project ID for new projects
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<ProjectFormData & { id?: string }>;
}

export default function ProjectForm({ onSubmit, onCancel, isLoading = false, initialData }: ProjectFormProps) {
  const { currentAccountId } = useAccount()
  const isEditing = Boolean(initialData?.name)

  // Migrate designFee to budgetCategories if it exists and budgetCategories doesn't have it
  const migratedBudgetCategories = (() => {
    if (initialData?.budgetCategories) {
      // If budgetCategories exists but designFee is 0/undefined and old designFee exists, merge it
      if ((!initialData.budgetCategories.designFee || initialData.budgetCategories.designFee === 0) 
          && initialData?.designFee !== undefined && initialData.designFee > 0) {
        return {
          ...initialData.budgetCategories,
          designFee: initialData.designFee
        }
      }
      return initialData.budgetCategories
    }
    if (initialData?.designFee !== undefined) {
      return {
        designFee: initialData.designFee,
        furnishings: 0,
        propertyManagement: 0,
        kitchen: 0,
        install: 0,
        storageReceiving: 0,
        fuel: 0
      }
    }
    return undefined
  })()

  const [formData, setFormData] = useState<ProjectFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    clientName: initialData?.clientName || '',
    budget: initialData?.budget || undefined,
    designFee: initialData?.designFee || undefined,
    budgetCategories: migratedBudgetCategories,
    mainImageUrl: initialData?.mainImageUrl || undefined,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.mainImageUrl || null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate total budget from all budget categories
  const calculateTotalBudget = (): number => {
    if (!formData.budgetCategories) return 0
    return Object.values(formData.budgetCategories).reduce((sum, value) => sum + (value || 0), 0)
  }

  const handleChange = (field: keyof ProjectFormData, value: string | number | ProjectBudgetCategories | undefined) => {
    if (field === 'budgetCategories' && typeof value === 'object') {
      setFormData(prev => ({ ...prev, [field]: value }))
    } else {
      const processedValue = typeof value === 'number' && value === 0 ? undefined : value
      setFormData(prev => ({ ...prev, [field]: processedValue }))
    }
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, image: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' }))
      return
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, image: 'File too large. Maximum size is 10MB.' }))
      return
    }

    setImageFile(file)
    setImagePreview(ImageUploadService.createPreviewUrl(file))
    setErrors(prev => ({ ...prev, image: '' }))
  }

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      ImageUploadService.revokePreviewUrl(imagePreview)
    }
    setImagePreview(null)
    setImageFile(null)
    setFormData(prev => ({ ...prev, mainImageUrl: undefined }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required'
    }

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required'
    }

    // Budget categories validation is handled in the individual fields

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.debug('ProjectForm: submit clicked', { formData })

    if (!validateForm()) {
      console.debug('ProjectForm: validation failed', { formData })
      return
    }

    try {
      setIsUploadingImage(true)

      // Filter out undefined values before submitting
      const cleanObject = (obj: any): any => {
        if (obj === null || obj === undefined) return undefined
        if (typeof obj === 'object') {
          const cleaned = Object.fromEntries(
            Object.entries(obj).filter(([_, value]) => value !== undefined)
          )
          return Object.keys(cleaned).length > 0 ? cleaned : undefined
        }
        return obj
      }

      // For editing: upload image first if new file selected
      let imageUrl = formData.mainImageUrl
      if (isEditing && imageFile && (initialData as any)?.id) {
        try {
          const uploadResult = await ImageUploadService.uploadProjectImage(
            imageFile,
            formData.name || 'Project',
            (initialData as any).id
          )
          imageUrl = uploadResult.url
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError)
          setErrors(prev => ({ ...prev, image: 'Failed to upload image. Please try again.' }))
          setIsUploadingImage(false)
          return
        }
      }

      const cleanedData = cleanObject({
        ...formData,
        mainImageUrl: imageUrl
      }) as ProjectFormData
      console.debug('ProjectForm: calling onSubmit with', { cleanedData })
      const result = await onSubmit(cleanedData)
      console.debug('ProjectForm: onSubmit resolved', { result })

      // For new projects: upload image after creation if projectId is returned
      if (!isEditing && imageFile && result && typeof result === 'string' && currentAccountId) {
        try {
          const uploadResult = await ImageUploadService.uploadProjectImage(
            imageFile,
            formData.name || 'Project',
            result
          )
          // Update project with image URL
          await projectService.updateProject(currentAccountId, result, {
            mainImageUrl: uploadResult.url
          })
        } catch (uploadError) {
          console.error('Error uploading image after project creation:', uploadError)
          // Don't fail the form submission, just log the error
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsUploadingImage(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto z-50">
      <div className="flex min-h-screen items-start sm:items-center justify-center p-4">
        <div className="relative w-full max-w-md mx-auto p-5 border shadow-lg rounded-md bg-white max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {isEditing ? 'Edit' : 'Create'}
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Project Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Project Name *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                  errors.name ? 'border-red-300' : ''
                }`}
                placeholder="Enter project name"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Client Name */}
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
                Client Name *
              </label>
              <input
                type="text"
                id="clientName"
                value={formData.clientName}
                onChange={(e) => handleChange('clientName', e.target.value)}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                  errors.clientName ? 'border-red-300' : ''
                }`}
                placeholder="Enter client name"
              />
              {errors.clientName && <p className="mt-1 text-sm text-red-600">{errors.clientName}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="Enter project description"
              />
            </div>

            {/* Main Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Project Image
              </label>
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Project preview"
                    className="w-full h-48 object-cover rounded-md border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    disabled={isUploadingImage}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500">JPEG, PNG, GIF, or WebP. Max 10MB.</p>
                </div>
              )}
              {errors.image && <p className="mt-1 text-sm text-red-600">{errors.image}</p>}
            </div>

            {/* Default Transaction Category moved to account-level presets (Settings → Presets → Budget Categories) */}

            {/* Budget Categories Section */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">Budget Categories</h4>
              <p className="text-sm text-gray-500 mb-4">Set specific budgets for different project categories. These will be used to track spending by category.</p>

              {/* Total Budget (Read-only) */}
              <div className="mb-4">
                <label htmlFor="totalBudget" className="block text-sm font-medium text-gray-700">
                  Total Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="totalBudget"
                    value={calculateTotalBudget().toFixed(2)}
                    readOnly
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm bg-gray-50 text-gray-700 sm:text-sm cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Automatically calculated from budget categories</p>
              </div>

              {/* Design Fee */}
              <div className="mb-4">
                <label htmlFor="budgetCategories.designFee" className="block text-sm font-medium text-gray-700">
                  Design Fee Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="budgetCategories.designFee"
                    value={formData.budgetCategories?.designFee?.toString() || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const newBudgetCategories: ProjectBudgetCategories = {
                        designFee: value > 0 ? value : 0,
                        furnishings: formData.budgetCategories?.furnishings || 0,
                        propertyManagement: formData.budgetCategories?.propertyManagement || 0,
                        kitchen: formData.budgetCategories?.kitchen || 0,
                        install: formData.budgetCategories?.install || 0,
                        storageReceiving: formData.budgetCategories?.storageReceiving || 0,
                        fuel: formData.budgetCategories?.fuel || 0
                      }
                      handleChange('budgetCategories', newBudgetCategories)
                    }}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Furnishings */}
              <div className="mb-4">
                <label htmlFor="budgetCategories.furnishings" className="block text-sm font-medium text-gray-700">
                  Furnishings Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="budgetCategories.furnishings"
                    value={formData.budgetCategories?.furnishings?.toString() || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const newBudgetCategories: ProjectBudgetCategories = {
                        designFee: formData.budgetCategories?.designFee || 0,
                        furnishings: value > 0 ? value : 0,
                        propertyManagement: formData.budgetCategories?.propertyManagement || 0,
                        kitchen: formData.budgetCategories?.kitchen || 0,
                        install: formData.budgetCategories?.install || 0,
                        storageReceiving: formData.budgetCategories?.storageReceiving || 0,
                        fuel: formData.budgetCategories?.fuel || 0
                      }
                      handleChange('budgetCategories', newBudgetCategories)
                    }}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Property Management */}
              <div className="mb-4">
                <label htmlFor="budgetCategories.propertyManagement" className="block text-sm font-medium text-gray-700">
                  Property Management Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="budgetCategories.propertyManagement"
                    value={formData.budgetCategories?.propertyManagement?.toString() || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const newBudgetCategories: ProjectBudgetCategories = {
                        designFee: formData.budgetCategories?.designFee || 0,
                        furnishings: formData.budgetCategories?.furnishings || 0,
                        propertyManagement: value > 0 ? value : 0,
                        kitchen: formData.budgetCategories?.kitchen || 0,
                        install: formData.budgetCategories?.install || 0,
                        storageReceiving: formData.budgetCategories?.storageReceiving || 0,
                        fuel: formData.budgetCategories?.fuel || 0
                      }
                      handleChange('budgetCategories', newBudgetCategories)
                    }}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Kitchen */}
              <div className="mb-4">
                <label htmlFor="budgetCategories.kitchen" className="block text-sm font-medium text-gray-700">
                  Kitchen Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="budgetCategories.kitchen"
                    value={formData.budgetCategories?.kitchen?.toString() || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const newBudgetCategories: ProjectBudgetCategories = {
                        designFee: formData.budgetCategories?.designFee || 0,
                        furnishings: formData.budgetCategories?.furnishings || 0,
                        propertyManagement: formData.budgetCategories?.propertyManagement || 0,
                        kitchen: value > 0 ? value : 0,
                        install: formData.budgetCategories?.install || 0,
                        storageReceiving: formData.budgetCategories?.storageReceiving || 0,
                        fuel: formData.budgetCategories?.fuel || 0
                      }
                      handleChange('budgetCategories', newBudgetCategories)
                    }}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Install */}
              <div className="mb-4">
                <label htmlFor="budgetCategories.install" className="block text-sm font-medium text-gray-700">
                  Install Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="budgetCategories.install"
                    value={formData.budgetCategories?.install?.toString() || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const newBudgetCategories: ProjectBudgetCategories = {
                        designFee: formData.budgetCategories?.designFee || 0,
                        furnishings: formData.budgetCategories?.furnishings || 0,
                        propertyManagement: formData.budgetCategories?.propertyManagement || 0,
                        kitchen: formData.budgetCategories?.kitchen || 0,
                        install: value > 0 ? value : 0,
                        storageReceiving: formData.budgetCategories?.storageReceiving || 0,
                        fuel: formData.budgetCategories?.fuel || 0
                      }
                      handleChange('budgetCategories', newBudgetCategories)
                    }}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Storage & Receiving */}
              <div className="mb-4">
                <label htmlFor="budgetCategories.storageReceiving" className="block text-sm font-medium text-gray-700">
                  Storage & Receiving Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="budgetCategories.storageReceiving"
                    value={formData.budgetCategories?.storageReceiving?.toString() || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const newBudgetCategories: ProjectBudgetCategories = {
                        designFee: formData.budgetCategories?.designFee || 0,
                        furnishings: formData.budgetCategories?.furnishings || 0,
                        propertyManagement: formData.budgetCategories?.propertyManagement || 0,
                        kitchen: formData.budgetCategories?.kitchen || 0,
                        install: formData.budgetCategories?.install || 0,
                        storageReceiving: value > 0 ? value : 0,
                        fuel: formData.budgetCategories?.fuel || 0
                      }
                      handleChange('budgetCategories', newBudgetCategories)
                    }}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Fuel */}
              <div className="mb-4">
                <label htmlFor="budgetCategories.fuel" className="block text-sm font-medium text-gray-700">
                  Fuel Budget
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="budgetCategories.fuel"
                    value={formData.budgetCategories?.fuel?.toString() || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      const newBudgetCategories: ProjectBudgetCategories = {
                        designFee: formData.budgetCategories?.designFee || 0,
                        furnishings: formData.budgetCategories?.furnishings || 0,
                        propertyManagement: formData.budgetCategories?.propertyManagement || 0,
                        kitchen: formData.budgetCategories?.kitchen || 0,
                        install: formData.budgetCategories?.install || 0,
                        storageReceiving: formData.budgetCategories?.storageReceiving || 0,
                        fuel: value > 0 ? value : 0
                      }
                      handleChange('budgetCategories', newBudgetCategories)
                    }}
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isUploadingImage}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isLoading || isUploadingImage
                  ? (isEditing ? 'Updating...' : 'Creating...')
                  : (isEditing ? 'Update Project' : 'Create Project')
                }
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
