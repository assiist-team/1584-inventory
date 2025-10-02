import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Bookmark, Printer, RotateCcw, Trash2, Edit, FileText, ShoppingBag, Tag, DollarSign, CreditCard, ImagePlus } from 'lucide-react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Item, ItemImage } from '@/types'
import { formatDate } from '@/utils/dateUtils'
import { itemService, projectService } from '@/services/inventoryService'
import { ImageUploadService } from '@/services/imageService'
import ImagePreview from '@/components/ui/ImagePreview'
import { getUserFriendlyErrorMessage, getErrorAction } from '@/utils/imageUtils'
import { useToast } from '@/components/ui/ToastContext'

export default function ItemDetail() {
  const { id, itemId } = useParams<{ id?: string; itemId?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [item, setItem] = useState<Item | null>(null)
  const [projectName, setProjectName] = useState<string>('')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const { showError } = useToast()

  // Use itemId if available (from /project/:id/item/:itemId), otherwise use id (from /item/:id)
  const actualItemId = itemId || id

  // Get project ID from URL path (for /project/:id/item/:itemId) or search parameters (for /item/:id)
  const projectId = id || searchParams.get('project')

  // Determine back navigation destination based on item's transaction association
  const backDestination = useMemo(() => {
    // If item is not loaded yet (null), default to inventory
    if (!item) {
      return `/project/${projectId}?tab=inventory`
    }

    // If item is the sample item (error/loading state), default to inventory
    if (item.item_id === 'I-1' && item.description === 'Marble Countertop Sample') {
      return `/project/${projectId}?tab=inventory`
    }

    // If item is loaded and has a transaction_id, go back to transaction detail
    if (item.transaction_id && projectId) {
      return `/project/${projectId}/transaction/${item.transaction_id}`
    }

    // Otherwise, go to inventory
    return `/project/${projectId}?tab=inventory`
  }, [item, projectId])

  // Initialize with sample data for demo
  const sampleItem: Item = {
    item_id: actualItemId || 'I-1',
    description: 'Marble Countertop Sample',
    source: 'Home Depot',
    sku: 'MCT-001',
    price: '150.00',
    resale_price: '250.00',
    market_value: '300.00',
    payment_method: '1584 Card',
    notes: 'High-end marble sample for client presentation',
    qr_key: 'QR001',
    bookmark: true,
    disposition: 'keep',
    transaction_id: 'T-1',
    project_id: 'P-1',
    date_created: '2024-01-15',
    last_updated: '2024-01-20'
  }

  useEffect(() => {
    const fetchItem = async () => {
      if (actualItemId) {
        try {
          if (projectId) {
            const [fetchedItem, project] = await Promise.all([
              itemService.getItem(projectId, actualItemId),
              projectService.getProject(projectId)
            ])

            if (fetchedItem) {
              setItem(fetchedItem)
            } else {
              console.error('Item not found in project:', projectId, 'with ID:', actualItemId)
              setItem(sampleItem)
            }

            if (project) {
              setProjectName(project.name)
            }
          } else {
            console.error('No project ID found in URL parameters')
            setItem(sampleItem)
          }
        } catch (error) {
          console.error('Failed to fetch item:', error)
          setItem(sampleItem)
        }
      } else {
        setItem(sampleItem)
      }
    }

    fetchItem()
  }, [actualItemId, id, searchParams])

  // Set up real-time listener for item updates
  useEffect(() => {
    const currentProjectId = id || searchParams.get('project')
    if (!currentProjectId || !actualItemId) return

    console.log('Setting up real-time listener for item:', actualItemId)

    const unsubscribe = itemService.subscribeToItems(
      currentProjectId,
      (items) => {
        console.log('Real-time items update:', items.length, 'items')
        const updatedItem = items.find(item => item.item_id === actualItemId)
        if (updatedItem) {
          console.log('Found updated item with', updatedItem.images?.length || 0, 'images')
          setItem(updatedItem)
        }
      }
    )

    return () => {
      console.log('Cleaning up real-time listener for item:', actualItemId)
      unsubscribe()
    }
  }, [searchParams, actualItemId, id])

  const toggleBookmark = async () => {
    if (!item) return

    try {
      await itemService.updateItem(item.project_id, item.item_id, {
        bookmark: !item.bookmark
      })
      setItem({ ...item, bookmark: !item.bookmark })
    } catch (error) {
      console.error('Failed to update bookmark:', error)
    }
  }

  const toggleDisposition = async () => {
    if (!item) return

    try {
      const newDisposition = item.disposition === 'return' ? 'keep' : 'return'
      await itemService.updateItem(item.project_id, item.item_id, {
        disposition: newDisposition
      })
      setItem({ ...item, disposition: newDisposition })
    } catch (error) {
      console.error('Failed to update disposition:', error)
    }
  }

  const handleDeleteItem = async () => {
    if (!item || !projectId) return

    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return
    }

    try {
      await itemService.deleteItem(projectId, item.item_id)
      navigate(`/project/${projectId}?tab=inventory`)
    } catch (error) {
      console.error('Failed to delete item:', error)
      showError('Failed to delete item. Please try again.')
    }
  }

  const handleMultipleImageUpload = async (files: File[]) => {
    if (!item || !projectName) return

    try {
      setIsUploadingImage(true)
      setUploadProgress(0)

      console.log('Starting multiple image upload for', files.length, 'files')
      for (let i = 0; i < files.length; i++) {
        console.log(`Processing file ${i + 1}:`, files[i].name)
      }

      const uploadResults = await ImageUploadService.uploadMultipleItemImages(
        files,
        projectName,
        item.item_id,
        (fileIndex, progress) => {
          // Show progress for current file being uploaded
          const overallProgress = Math.round(((fileIndex + progress.percentage / 100) / files.length) * 100)
          setUploadProgress(overallProgress)
        }
      )

      console.log('All uploads completed successfully:', uploadResults.length, 'images')

      // Convert upload results to ItemImage objects
      const newImages: ItemImage[] = uploadResults.map((result, index) => ({
        url: result.url,
        alt: result.fileName,
        isPrimary: item.images?.length === 0 && index === 0, // First image is primary if no images exist
        uploadedAt: new Date(),
        fileName: result.fileName,
        size: result.size,
        mimeType: result.mimeType
      }))

      console.log('New image objects created:', newImages.length)

      // Update the item with all new images
      const currentImages = item.images || []
      const updatedImages = [...currentImages, ...newImages]

      console.log('Before update - item.images length:', currentImages.length)
      console.log('After update - updatedImages length:', updatedImages.length)
      console.log('New images URLs:', newImages.map(img => img.url))

      if (projectId) {
        console.log('Updating item in database with multiple new images')
        await itemService.updateItem(projectId, item.item_id, { images: updatedImages })
      }

      // Update local state
      setItem({ ...item, images: updatedImages })
      setUploadProgress(100)

      console.log('Multiple image upload completed successfully')
    } catch (error) {
      console.error('Error uploading multiple images:', error)
      const friendlyMessage = getUserFriendlyErrorMessage(error)
      const action = getErrorAction(error)
      showError(`${friendlyMessage} Suggestion: ${action}`)
    } finally {
      setIsUploadingImage(false)
      setUploadProgress(0)
    }
  }

  const handleSelectFromGallery = async () => {
    if (!item || !projectName) return

    try {
      setIsUploadingImage(true)
      const files = await ImageUploadService.selectFromGallery()

      if (files && files.length > 0) {
        console.log('Selected', files.length, 'files from gallery')
        await handleMultipleImageUpload(files)
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

      // Show error for actual failures
      const friendlyMessage = getUserFriendlyErrorMessage(error)
      const action = getErrorAction(error)
      showError(`${friendlyMessage} Suggestion: ${action}`)
    } finally {
      setIsUploadingImage(false)
      setUploadProgress(0)
    }
  }


  const handleRemoveImage = async (imageUrl: string) => {
    if (!item || !projectId) return

    try {
      // Remove from database
      if (projectId) {
        await itemService.removeItemImage(projectId, item.item_id, imageUrl)
      }

      // Update local state
      const updatedImages = item.images?.filter(img => img.url !== imageUrl) || []
      setItem({ ...item, images: updatedImages })
    } catch (error) {
      console.error('Error removing image:', error)
      const friendlyMessage = getUserFriendlyErrorMessage(error)
      const action = getErrorAction(error)
      showError(`${friendlyMessage} Suggestion: ${action}`)
    }
  }

  const handleSetPrimaryImage = async (imageUrl: string) => {
    if (!item || !projectId) return

    try {
      // Update in database
      if (projectId) {
        await itemService.setPrimaryImage(projectId, item.item_id, imageUrl)
      }

      // Update local state
      const updatedImages = item.images?.map(img => ({
        ...img,
        isPrimary: img.url === imageUrl
      })) || []
      setItem({ ...item, images: updatedImages })
    } catch (error) {
      console.error('Error setting primary image:', error)
      const friendlyMessage = getUserFriendlyErrorMessage(error)
      const action = getErrorAction(error)
      showError(`${friendlyMessage} Suggestion: ${action}`)
    }
  }

  if (!item) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            to={backDestination}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </div>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <p className="text-gray-500">Item not found.</p>
            {projectId && <p className="text-sm text-gray-400 mt-2">Project ID: {projectId}</p>}
            <p className="text-sm text-gray-400 mt-1">Item ID: {actualItemId || 'unknown'}</p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link
            to={backDestination}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>

          <div className="flex flex-wrap gap-2 sm:space-x-2">
            <Link
              to={`/project/${projectId}/edit-item/${item.item_id}?project=${projectId}`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>

            <button
              onClick={toggleBookmark}
              className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                item.bookmark
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <Bookmark className="h-4 w-4 mr-2" fill={item.bookmark ? 'currentColor' : 'none'} />
              {item.bookmark ? 'Bookmarked' : 'Bookmark'}
            </button>

            <button
              onClick={toggleDisposition}
              className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                item.disposition === 'return'
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {item.disposition === 'keep' ? 'Return' : 'Keep'}
            </button>

            <button
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => window.open(`/qr-image/${item.qr_key}`, '_blank')}
            >
              <Printer className="h-4 w-4 mr-2" />
              QR
            </button>

            <button
              onClick={handleDeleteItem}
              className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>

        {/* Item information */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">{item.description}</h1>
          </div>

          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  Description
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{item.description}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <ShoppingBag className="h-4 w-4 mr-1" />
                  Source
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{item.source}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  SKU
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{item.sku}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Price
                </dt>
                <dd className="mt-1 text-sm text-gray-900 font-medium">${item.price}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Market Value
                </dt>
                <dd className="mt-1 text-sm text-green-600 font-medium">${item.market_value || ''}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  1584 Resale Price
                </dt>
                <dd className="mt-1 text-sm text-primary-600 font-medium">${item.resale_price || ''}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <CreditCard className="h-4 w-4 mr-1" />
                  Payment Method
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{item.payment_method}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Disposition
                </dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    item.disposition === 'return'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {item.disposition === 'return' ? 'Return' : item.disposition === 'keep' ? 'Keep' : item.disposition === 'inventory' ? 'Inventory' : item.disposition}
                  </span>
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  Notes
                </dt>
                <dd className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{item.notes || 'No notes'}</dd>
              </div>
            </dl>
          </div>

          {/* Item Images */}
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Item Images</h3>
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
                <p className="text-sm text-gray-500 mb-3">No images for this item yet</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project</dt>
                <dd className="mt-1 text-sm text-gray-900">{projectName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transaction</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <Link
                    to={`/project/${projectId}/transaction/${item.transaction_id}`}
                    className="text-primary-600 hover:text-primary-800 underline"
                  >
                    {item.transaction_id}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(item.date_created)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}


