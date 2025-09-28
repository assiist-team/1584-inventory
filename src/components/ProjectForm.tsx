import { useState } from 'react'
import { X, DollarSign } from 'lucide-react'

interface ProjectFormData {
  name: string;
  description: string;
  clientName: string;
  budget?: number;
  designFee?: number;
}

interface ProjectFormProps {
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<ProjectFormData>;
}

export default function ProjectForm({ onSubmit, onCancel, isLoading = false, initialData }: ProjectFormProps) {
  const isEditing = Boolean(initialData?.name)

  const [formData, setFormData] = useState<ProjectFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    clientName: initialData?.clientName || '',
    budget: initialData?.budget || undefined,
    designFee: initialData?.designFee || undefined,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (field: keyof ProjectFormData, value: string | number) => {
    const processedValue = typeof value === 'number' && value === 0 ? undefined : value
    setFormData(prev => ({ ...prev, [field]: processedValue }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
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

    // Budget and design fee are optional, but if provided, should be valid numbers
    if (formData.budget !== undefined && (isNaN(formData.budget) || formData.budget < 0)) {
      newErrors.budget = 'Budget must be a positive number'
    }

    if (formData.designFee !== undefined && (isNaN(formData.designFee) || formData.designFee < 0)) {
      newErrors.designFee = 'Design fee must be a positive number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Error submitting form:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
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

            {/* Budget */}
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-gray-700">
                Budget (Optional)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="number"
                  id="budget"
                  value={formData.budget?.toString() || ''}
                  onChange={(e) => handleChange('budget', parseFloat(e.target.value) || 0)}
                  className={`block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                    errors.budget ? 'border-red-300' : ''
                  }`}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              {errors.budget && <p className="mt-1 text-sm text-red-600">{errors.budget}</p>}
            </div>

            {/* Design Fee */}
            <div>
              <label htmlFor="designFee" className="block text-sm font-medium text-gray-700">
                Design Fee (Optional)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="number"
                  id="designFee"
                  value={formData.designFee?.toString() || ''}
                  onChange={(e) => handleChange('designFee', parseFloat(e.target.value) || 0)}
                  className={`block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                    errors.designFee ? 'border-red-300' : ''
                  }`}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              {errors.designFee && <p className="mt-1 text-sm text-red-600">{errors.designFee}</p>}
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
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isLoading
                  ? (isEditing ? 'Updating...' : 'Creating...')
                  : (isEditing ? 'Update Project' : 'Create Project')
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
