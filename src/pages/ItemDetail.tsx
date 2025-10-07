import { useState, useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, Bookmark, QrCode, Trash2, Edit, FileText, ImagePlus, ChevronDown, Copy } from 'lucide-react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Item, ItemImage } from '@/types'
import { formatDate } from '@/utils/dateUtils'
import { unifiedItemsService, projectService, integrationService } from '@/services/inventoryService'
import { ImageUploadService } from '@/services/imageService'
import ImagePreview from '@/components/ui/ImagePreview'
import { getUserFriendlyErrorMessage, getErrorAction } from '@/utils/imageUtils'
import { useToast } from '@/components/ui/ToastContext'
import { useDuplication } from '@/hooks/useDuplication'
import { useNavigationContext } from '@/hooks/useNavigationContext'

export default function ItemDetail() {
  const { id, itemId } = useParams<{ id?: string; itemId?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [item, setItem] = useState<Item | null>(null)
  const [projectName, setProjectName] = useState<string>('')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [openDispositionMenu, setOpenDispositionMenu] = useState(false)
  const [isSticky, setIsSticky] = useState(false)
  const { showError } = useToast()
  const { buildContextUrl, getBackDestination } = useNavigationContext()
  const stickyRef = useRef<HTMLDivElement>(null)

  // Use itemId if available (from /project/:id/item/:itemId), otherwise use id (from /item/:id)
  const actualItemId = itemId || id

  // Get project ID from URL path (for /project/:id/item/:itemId) or search parameters (for /item/:id)
  // For business inventory items, the URL structure is /business-inventory/:id
  const projectId = searchParams.get('project') || id

  // Check if this is a business inventory item (no project context)
  const isBusinessInventoryItem = !projectId && location.pathname.startsWith('/business-inventory/')

  // Use duplication hook
  const { duplicateItem } = useDuplication({
    items: item ? [item] : [],
    setItems: (items) => {
      if (typeof items === 'function') {
        setItem(prev => items([prev!])[0] || prev)
      } else if (items.length > 0) {
        setItem(items[0])
      }
    },
    projectId
  })

  // Determine back navigation destination using navigation context
  const backDestination = useMemo(() => {
    // If item is not loaded yet (null), use appropriate default
    if (!item) {
      return isBusinessInventoryItem ? '/business-inventory' : `/project/${projectId}?tab=inventory`
    }

    // Use navigation context's getBackDestination function
    const defaultPath = isBusinessInventoryItem ? '/business-inventory' : `/project/${projectId}?tab=inventory`
    return getBackDestination(defaultPath)
  }, [item, projectId, getBackDestination, isBusinessInventoryItem])


  useEffect(() => {
    const fetchItem = async () => {
      console.log('🔄 ItemDetail useEffect triggered. itemId:', actualItemId, 'id:', id, 'projectId:', projectId)

      if (actualItemId) {
        try {
          if (isBusinessInventoryItem) {
            console.log('📦 Fetching business inventory item (no project context)...')
            const fetchedItem = await unifiedItemsService.getItemById(actualItemId)

            if (fetchedItem) {
              console.log('✅ Business inventory item loaded successfully:', fetchedItem.item_id)
              setItem(fetchedItem)
              setProjectName('Business Inventory') // Set a default project name for UI display
            } else {
              console.error('❌ Business inventory item not found with ID:', actualItemId)
              setItem(null)
            }
          } else if (projectId) {
            console.log('📡 Fetching item and project data...')
            const [fetchedItem, project] = await Promise.all([
              unifiedItemsService.getItemById(actualItemId),
              projectService.getProject(projectId)
            ])

            if (fetchedItem) {
              console.log('✅ Item loaded successfully:', fetchedItem.item_id)
              setItem(fetchedItem)
            } else {
              console.error('❌ Item not found in project:', projectId, 'with ID:', actualItemId)
              setItem(null)
            }

            if (project) {
              console.log('✅ Project loaded:', project.name)
              setProjectName(project.name)
            }
          } else {
            console.error('❌ No project ID found in URL parameters')
            setItem(null)
          }
        } catch (error) {
          console.error('❌ Failed to fetch item:', error)
          setItem(null)
        }
      } else {
        console.log('⚠️ No itemId or id in URL parameters')
        setItem(null)
      }
    }

    fetchItem()
  }, [actualItemId, id, searchParams])

  // Set up real-time listener for item updates
  useEffect(() => {
    const currentProjectId = id || searchParams.get('project')
    if (!currentProjectId || !actualItemId) return

    console.log('Setting up real-time listener for item:', actualItemId)

    const unsubscribe = unifiedItemsService.subscribeToItemsByProject(
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

  // Close disposition menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDispositionMenu && !event.target) return

      const target = event.target as Element
      if (!target.closest('.disposition-menu') && !target.closest('.disposition-badge')) {
        setOpenDispositionMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDispositionMenu])

  // Handle sticky header border
  useEffect(() => {
    const handleScroll = () => {
      if (stickyRef.current) {
        const rect = stickyRef.current.getBoundingClientRect()
        const isElementSticky = rect.top <= 0
        setIsSticky(isElementSticky)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Check initial state

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const toggleBookmark = async () => {
    if (!item) return

    try {
      await unifiedItemsService.updateItem(item.item_id, {
        bookmark: !item.bookmark
      })
      setItem({ ...item, bookmark: !item.bookmark })
    } catch (error) {
      console.error('Failed to update bookmark:', error)
    }
  }

  const updateDisposition = async (newDisposition: string) => {
    console.log('🎯 updateDisposition called with:', newDisposition, 'Current item:', item?.item_id)

    if (!item) {
      console.error('❌ No item available for disposition update')
      return
    }

    console.log('📝 Updating disposition from', item.disposition, 'to', newDisposition)

    try {
      // Update the disposition in the database first
      await unifiedItemsService.updateItem(item.item_id, {
        disposition: newDisposition
      })
      console.log('💾 Database updated successfully')

      // Update local state
      setItem({ ...item, disposition: newDisposition })
      setOpenDispositionMenu(false)

      // If disposition is set to 'inventory', trigger deallocation process
      if (newDisposition === 'inventory') {
        console.log('🚀 Starting deallocation process for item:', item.item_id)
        try {
          await integrationService.handleItemDeallocation(
            item.item_id,
            item.project_id || '',
            newDisposition
          )
          console.log('✅ Deallocation completed successfully')
          // Refresh the item data after deallocation
          const updatedItem = await unifiedItemsService.getItemById(item.item_id)
          if (updatedItem) {
            setItem(updatedItem)
          }
        } catch (deallocationError) {
          console.error('❌ Failed to handle deallocation:', deallocationError)
          // Revert the disposition change if deallocation fails
          await unifiedItemsService.updateItem(item.item_id, {
            disposition: item.disposition // Revert to previous disposition
          })
          setItem({ ...item, disposition: item.disposition })
          showError('Failed to move item to inventory. Please try again.')
        }
      }
    } catch (error) {
      console.error('Failed to update disposition:', error)
      showError('Failed to update disposition. Please try again.')
    }
  }

  const toggleDispositionMenu = () => {
    console.log('🖱️ toggleDispositionMenu called, current state:', openDispositionMenu, 'item:', item?.item_id)
    setOpenDispositionMenu(!openDispositionMenu)
  }

  const getDispositionBadgeClasses = (disposition: string) => {
    const baseClasses = 'inline-flex items-center px-3 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors hover:opacity-80'

    switch (disposition) {
      case 'keep':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'to return':
      case 'return': // Backward compatibility for old disposition
        return `${baseClasses} bg-red-100 text-red-700`
      case 'returned':
        return `${baseClasses} bg-red-800 text-red-100`
      case 'inventory':
        return `${baseClasses} bg-primary-100 text-primary-600`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const handleDeleteItem = async () => {
    if (!item) return

    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return
    }

    try {
      await unifiedItemsService.deleteItem(item.item_id)
      navigate(isBusinessInventoryItem ? '/business-inventory' : `/project/${projectId}?tab=inventory`)
    } catch (error) {
      console.error('Failed to delete item:', error)
      showError('Failed to delete item. Please try again.')
    }
  }

  const handleMultipleImageUpload = async (files: File[]) => {
    if (!item) return

    try {
      setIsUploadingImage(true)
      setUploadProgress(0)

      console.log('Starting multiple image upload for', files.length, 'files')
      for (let i = 0; i < files.length; i++) {
        console.log(`Processing file ${i + 1}:`, files[i].name)
      }

      const uploadResults = await ImageUploadService.uploadMultipleItemImages(
        files,
        projectName || 'Business Inventory',
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
        await unifiedItemsService.updateItem(item.item_id, { images: updatedImages })
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
    if (!item) return

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
    if (!item) return

    try {
      // Remove from database
      await unifiedItemsService.updateItem(item.item_id, {
        images: item.images?.filter(img => img.url !== imageUrl) || []
      })

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
    if (!item) return

    try {
      // Update in database
      await unifiedItemsService.updateItem(item.item_id, {
        images: item.images?.map(img => ({
          ...img,
          isPrimary: img.url === imageUrl
        })) || []
      })

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
      {/* Sticky Header Controls */}
      <div
        ref={stickyRef}
        className={`sticky top-0 bg-gray-50 z-10 px-4 py-2 ${isSticky ? 'border-b border-gray-200' : ''}`}
      >
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
            <button
              onClick={toggleBookmark}
              className={`inline-flex items-center justify-center p-2 border text-sm font-medium rounded-md ${
                item.bookmark
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
              title={item.bookmark ? 'Remove Bookmark' : 'Add Bookmark'}
            >
              <Bookmark className="h-4 w-4" fill={item.bookmark ? 'currentColor' : 'none'} />
            </button>

            <Link
              to={isBusinessInventoryItem
                ? `/business-inventory/${item.item_id}/edit?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
                : `/project/${projectId}/edit-item/${item.item_id}?project=${projectId}&returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
              }
              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              title="Edit Item"
            >
              <Edit className="h-4 w-4" />
            </Link>

            <button
              onClick={() => duplicateItem(item.item_id)}
              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              title="Duplicate Item"
            >
              <Copy className="h-4 w-4" />
            </button>

            <button
              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => window.open(`/qr-image/${item.qr_key}`, '_blank')}
              title="View QR Code"
            >
              <QrCode className="h-4 w-4" />
            </button>


            <div className="relative">
              <span
                onClick={toggleDispositionMenu}
                className={`disposition-badge ${getDispositionBadgeClasses(item.disposition || 'keep')}`}
              >
                {item.disposition === 'to return' ? 'To Return' : (item.disposition || 'keep').charAt(0).toUpperCase() + (item.disposition || 'keep').slice(1)}
                <ChevronDown className="h-3 w-3 ml-1" />
              </span>

              {/* Dropdown menu */}
              {openDispositionMenu && (
                <div className="disposition-menu absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                  <div className="py-2">
                    {['keep', 'to return', 'returned', 'inventory'].map((disposition) => (
                      <button
                        key={disposition}
                        onClick={() => updateDisposition(disposition)}
                        className={`block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${
                          (item.disposition === disposition) || (disposition === 'to return' && item.disposition === 'return')
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700'
                        }`}
                      >
                        {disposition === 'to return' ? 'To Return' : disposition.charAt(0).toUpperCase() + disposition.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

              {item.payment_method && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                  <dd className="mt-1 text-sm text-gray-900">{item.payment_method}</dd>
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
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project</dt>
                  <dd className="mt-1 text-sm text-gray-900">{projectName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transaction</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <Link
                      to={isBusinessInventoryItem
                        ? buildContextUrl(`/business-inventory/transaction/${item.transaction_id}`)
                        : buildContextUrl(`/project/${projectId}/transaction/${item.transaction_id}`)
                      }
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

              {/* Delete button in lower right corner */}
              <div className="absolute bottom-0 right-0">
                <button
                  onClick={handleDeleteItem}
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
    </div>
  )
}



