import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Edit, Trash2, ArrowLeft, Package, Plus, ImagePlus, FileText, Copy } from 'lucide-react'
import { BusinessInventoryItem, Project } from '@/types'
import { businessInventoryService, projectService } from '@/services/inventoryService'
import { formatDate } from '@/utils/dateUtils'
import ImagePreview from '@/components/ui/ImagePreview'
import { ImageUploadService } from '@/services/imageService'
import { useDuplication } from '@/hooks/useDuplication'

export default function BusinessInventoryItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<BusinessInventoryItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [allocationForm, setAllocationForm] = useState({
    projectId: ''
  })

  // Image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)

  // Navigation context logic for basic back navigation
  const backDestination = '/business-inventory' // Always go back to main inventory list

  // Use duplication hook for business inventory items
  const { duplicateItem } = useDuplication({
    items: item ? [item] : [],
    setItems: (items) => {
      if (typeof items === 'function') {
        setItem(prev => items([prev!])[0] || prev)
      } else if (items.length > 0) {
        setItem(items[0])
      }
    },
    duplicationService: (itemId: string) => businessInventoryService.duplicateBusinessInventoryItem(itemId)
  })

  // Helper functions
  const formatLinkedProjectText = (projectId: string): string => {
    const project = projects.find(p => p.id === projectId)
    return project ? `${project.name} - ${project.clientName}` : projectId
  }

  useEffect(() => {
    if (id) {
      loadItem()
      loadProjects()
    }
  }, [id])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProjectDropdown && !event.target) return

      const target = event.target as Element
      if (!target.closest('.project-dropdown') && !target.closest('.project-dropdown-button')) {
        setShowProjectDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProjectDropdown])

  const loadProjects = async () => {
    try {
      const projectsData = await projectService.getProjects()
      setProjects(projectsData)
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  // Subscribe to real-time updates
  useEffect(() => {
    if (!id) return

    const unsubscribe = businessInventoryService.subscribeToBusinessInventory(
      (items) => {
        const updatedItem = items.find(i => i.item_id === id)
        if (updatedItem) {
          setItem(updatedItem)
        }
      }
    )

    return unsubscribe
  }, [id])

  const loadItem = async () => {
    if (!id) return

    try {
      const itemData = await businessInventoryService.getBusinessInventoryItem(id)
      setItem(itemData)
    } catch (error) {
      console.error('Error loading item:', error)
    } finally {
      setIsLoading(false)
    }
  }


  const handleDelete = async () => {
    if (!id || !item) return

    if (window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      try {
        await businessInventoryService.deleteBusinessInventoryItem(id)
        navigate('/business-inventory')
      } catch (error) {
        console.error('Error deleting item:', error)
        alert('Error deleting item. Please try again.')
      }
    }
  }



  const openAllocationModal = () => {
    setShowAllocationModal(true)
  }

  const closeAllocationModal = () => {
    setShowAllocationModal(false)
    setShowProjectDropdown(false)
    setAllocationForm({
      projectId: ''
    })
  }

  const getSelectedProjectName = () => {
    const selectedProject = projects.find(p => p.id === allocationForm.projectId)
    return selectedProject ? `${selectedProject.name} - ${selectedProject.clientName}` : 'Select a project...'
  }

  const handleAllocationSubmit = async () => {
    if (!id || !allocationForm.projectId) return

    setIsUpdating(true)
    try {
      await businessInventoryService.allocateItemToProject(
        id,
        allocationForm.projectId
      )
      closeAllocationModal()
      // Item will be updated via real-time subscription
    } catch (error) {
      console.error('Error allocating item:', error)
      alert('Error allocating item. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Image handling functions
  const handleSelectFromGallery = async () => {
    if (!item || !item.item_id) return

    try {
      setIsUploadingImage(true)
      setUploadProgress(0)

      const files = await ImageUploadService.selectFromGallery()

      if (files && files.length > 0) {
        console.log('Selected', files.length, 'files from gallery')

        // Process all selected files sequentially
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          await processImageUpload(file, files)
        }
      } else {
        console.log('No files selected from gallery')
      }
    } catch (error: any) {
      console.error('Error selecting from gallery:', error)

      // Handle cancel/timeout gracefully - don't show error for user cancellation
      if (error.message?.includes('timeout') || error.message?.includes('canceled')) {
        console.log('User canceled image selection or selection timed out')
        return
      }

      alert('Failed to add images. Please try again.')
    } finally {
      setIsUploadingImage(false)
      setUploadProgress(0)
    }
  }

  const processImageUpload = async (file: File, allFiles?: File[]) => {
    if (!item?.item_id) return

    const uploadResult = await ImageUploadService.uploadItemImage(
      file,
      'Business Inventory',
      item.item_id
    )

    const newImage = {
      url: uploadResult.url,
      alt: file.name,
      isPrimary: item.images?.length === 0, // First image is always primary when added from detail view
      uploadedAt: new Date(),
      fileName: file.name,
      size: file.size,
      mimeType: file.type
    }

    // Update the item with the new image
    const currentImages = item.images || []
    const updatedImages = [...currentImages, newImage]

    await businessInventoryService.updateBusinessInventoryItem(item.item_id, { images: updatedImages })

    // Show success notification on the last file
    if (allFiles && allFiles.indexOf(file) === allFiles.length - 1) {
      const message = allFiles.length > 1 ? `${allFiles.length} images uploaded successfully!` : 'Image uploaded successfully!'
      alert(message)
    }
  }

  const handleRemoveImage = async (imageUrl: string) => {
    if (!item?.item_id) return

    try {
      // Update in database
      const updatedImages = item.images?.filter(img => img.url !== imageUrl) || []
      await businessInventoryService.updateBusinessInventoryItem(item.item_id, { images: updatedImages })

      // Update local state
      setItem({ ...item, images: updatedImages })
    } catch (error) {
      console.error('Error removing image:', error)
      alert('Error removing image. Please try again.')
    }
  }

  const handleSetPrimaryImage = async (imageUrl: string) => {
    if (!item?.item_id) return

    try {
      // Update in database
      const updatedImages = item.images?.map(img => ({
        ...img,
        isPrimary: img.url === imageUrl
      })) || []
      await businessInventoryService.updateBusinessInventoryItem(item.item_id, { images: updatedImages })

      // Update local state
      setItem({ ...item, images: updatedImages })
    } catch (error) {
      console.error('Error setting primary image:', error)
      alert('Error setting primary image. Please try again.')
    }
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
        <Package className="mx-auto h-16 w-16 text-gray-400 -mb-1" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          Item not found
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          The item you're looking for doesn't exist or has been deleted.
        </p>
        <Link
          to={backDestination}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header Controls */}
      <div className="sticky top-0 bg-gray-50 z-10 px-4 py-2 border-b border-gray-200">
        {/* Back button and controls row */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to={backDestination}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>

          <div className="flex flex-wrap gap-2 sm:space-x-2">
            {item.inventory_status === 'available' && (
              <button
                onClick={openAllocationModal}
                disabled={isUpdating}
                className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                title="Allocate to Project"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <Link
              to={`/business-inventory/${id}/edit?returnTo=/business-inventory/${id}`}
              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              title="Edit Item"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button
              onClick={() => item && duplicateItem(item.item_id)}
              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              title="Duplicate Item"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">

        {/* Item information */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4">
            <h1 className="text-xl font-semibold text-gray-900">{item.description}</h1>
          </div>

          {/* Item Images */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <ImagePlus className="h-5 w-5 mr-2" />
                Item Images
              </h3>
              <button
                onClick={handleSelectFromGallery}
                disabled={isUploadingImage}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                title="Add images from gallery or camera"
              >
                <ImagePlus className="h-3 w-3 mr-1" />
                {isUploadingImage
                  ? uploadProgress > 0 && uploadProgress < 100
                    ? `Uploading... ${Math.round(uploadProgress)}%`
                    : 'Uploading...'
                  : 'Add Images'
                }
              </button>
            </div>

            {item.images && item.images.length > 0 ? (
              <ImagePreview
                images={item.images}
                onRemoveImage={handleRemoveImage}
                onSetPrimary={handleSetPrimaryImage}
                maxImages={5}
                size="md"
                showControls={true}
              />
            ) : (
              <div className="text-center py-8">
                <ImagePlus className="mx-auto h-8 w-8 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No images uploaded</h3>
              </div>
            )}
          </div>

          {/* Item Details */}
          <div className="px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Item Details
            </h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {item.source && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Source</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{item.source}</dd>
                </div>
              )}

              {item.sku && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">SKU</dt>
                  <dd className="mt-1 text-sm text-gray-900">{item.sku}</dd>
                </div>
              )}

              {item.purchase_price && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Purchase Price</dt>
                  <p className="text-xs text-gray-500 mt-1">What the item was purchased for</p>
                  <dd className="mt-1 text-sm text-gray-900 font-medium">${item.purchase_price}</dd>
                </div>
              )}

              {item.project_price && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Project Price</dt>
                  <p className="text-xs text-gray-500 mt-1">What the client is charged</p>
                  <dd className="mt-1 text-sm text-gray-900 font-medium">${item.project_price}</dd>
                </div>
              )}

              {item.market_value && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Market Value</dt>
                  <p className="text-xs text-gray-500 mt-1">The fair market value of the item</p>
                  <dd className="mt-1 text-sm text-gray-900 font-medium">${item.market_value}</dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.inventory_status === 'available'
                      ? 'bg-green-100 text-green-800'
                      : item.inventory_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {item.inventory_status === 'available' ? 'Available' :
                     item.inventory_status === 'pending' ? 'Allocated' : 'Sold'}
                  </span>
                </dd>
              </div>

              {item.business_inventory_location && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Location</dt>
                  <dd className="mt-1 text-sm text-gray-900">{item.business_inventory_location}</dd>
                </div>
              )}

              {item.notes && item.notes !== 'No notes' && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{item.notes}</dd>
                </div>
              )}
            </dl>
          </div>


          {/* Metadata */}
          <div className="px-6 py-4 bg-gray-50">
            <div className="relative">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date Added</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(item.date_created)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(item.last_updated)}</dd>
                </div>

                {item.current_project_id && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <Link
                        to={`/project/${item.current_project_id}?from=business-inventory-item&returnTo=/business-inventory/${id}`}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        {formatLinkedProjectText(item.current_project_id)}
                      </Link>
                    </dd>
                  </div>
                )}

                {item.pending_transaction_id && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">TRANSACTION</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <Link
                        to={`/project/${item.current_project_id}/transaction/${item.pending_transaction_id}?from=business-inventory-item&returnTo=/business-inventory/${id}`}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        {item.pending_transaction_id}
                      </Link>
                    </dd>
                  </div>
                )}

                {item.transaction_id && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Original Transaction</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className="text-gray-600 font-medium">{item.transaction_id}</span>
                    </dd>
                  </div>
                )}
              </dl>

              {/* Delete button in lower right corner */}
              <div className="absolute bottom-0 right-0">
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center justify-center p-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  title="Delete Item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Allocation Modal */}
      {showAllocationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Allocate Item to Project</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Select Project
                  </label>
                  <div className="relative mt-1">
                    <button
                      type="button"
                      onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                      className="project-dropdown-button relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    >
                      <span className={`block truncate ${!allocationForm.projectId ? 'text-gray-500' : 'text-gray-900'}`}>
                        {getSelectedProjectName()}
                      </span>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </button>

                    {showProjectDropdown && (
                      <div className="project-dropdown absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base border border-gray-200 overflow-auto focus:outline-none sm:text-sm">
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => {
                              setAllocationForm(prev => ({ ...prev, projectId: project.id }))
                              setShowProjectDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                              allocationForm.projectId === project.id ? 'bg-primary-50 text-primary-600' : 'text-gray-900'
                            }`}
                          >
                            <div className="font-medium">{project.name}</div>
                            <div className="text-sm text-gray-500">{project.clientName}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>


              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeAllocationModal}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAllocationSubmit}
                  disabled={!allocationForm.projectId || isUpdating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {isUpdating ? 'Allocating...' : 'Allocate Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
