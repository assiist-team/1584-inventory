import { useState, useEffect } from 'react'
import { Plus, Search, Bookmark, Printer, RotateCcw, Trash2, Camera } from 'lucide-react'
import { Link } from 'react-router-dom'
import { itemService } from '@/services/inventoryService'
import { ImageUploadService } from '@/services/imageService'
import { ItemImage } from '@/types'
import { useToast } from '@/components/ui/ToastContext'

interface InventoryItem {
  item_id: string
  description: string
  source: string
  sku: string
  price: string
  "1584_resale_price"?: string
  resale_price?: string
  market_value?: string
  payment_method: string
  notes?: string
  qr_key: string
  bookmark: boolean
  disposition: string
  date_created: string
  last_updated: string
  transaction_id: string
  project_id: string
}

interface InventoryListProps {
  projectId: string
  projectName: string
}

export default function InventoryList({ projectId, projectName }: InventoryListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())
  const { showSuccess, showError } = useToast()

  // Fetch real inventory data from Firestore
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('Fetching items for project:', projectId)
        const realItems = await itemService.getItems(projectId)
        console.log('Fetched items:', realItems.length, realItems)
        setItems(realItems)
      } catch (error) {
        console.error('Failed to fetch items:', error)
        setError('Failed to load inventory items. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchItems()

    // Subscribe to real-time updates
    const unsubscribe = itemService.subscribeToItems(projectId, (updatedItems) => {
      console.log('Real-time items update:', updatedItems.length, updatedItems)
      setItems(updatedItems)
    })

    // Cleanup subscription on unmount
    return () => {
      unsubscribe()
    }
  }, [projectId])

  // Reset uploading state on unmount to prevent hanging state
  useEffect(() => {
    return () => {
      setUploadingImages(new Set())
    }
  }, [])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(item => item.item_id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }

  const toggleBookmark = async (itemId: string) => {
    try {
      const item = items.find(item => item.item_id === itemId)
      if (!item) return

      const newBookmarkState = !item.bookmark

      // Update in Firestore
      await itemService.updateItem(projectId, itemId, { bookmark: newBookmarkState })

      // Update local state optimistically
      setItems(items.map(item =>
        item.item_id === itemId
          ? { ...item, bookmark: newBookmarkState }
          : item
      ))
    } catch (error) {
      console.error('Failed to update bookmark:', error)
      setError('Failed to update bookmark. Please try again.')
    }
  }

  const toggleDisposition = async (itemId: string) => {
    try {
      const item = items.find(item => item.item_id === itemId)
      if (!item) return

      const newDisposition = item.disposition === 'return' ? 'keep' : 'return'

      // Update in Firestore
      await itemService.updateItem(projectId, itemId, { disposition: newDisposition })

      // Update local state optimistically
      setItems(items.map(item =>
        item.item_id === itemId
          ? { ...item, disposition: newDisposition }
          : item
      ))
    } catch (error) {
      console.error('Failed to update disposition:', error)
      setError('Failed to update item disposition. Please try again.')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return
    }

    try {
      await itemService.deleteItem(projectId, itemId)
      setSelectedItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
      setError(null)
    } catch (error) {
      console.error('Failed to delete item:', error)
      setError('Failed to delete item. Please try again.')
    }
  }

  const handleAddImage = async (itemId: string) => {
    try {
      setUploadingImages(prev => new Set(prev).add(itemId))

      const files = await ImageUploadService.selectFromGallery()

      if (files.length > 0) {
        // Process all selected files sequentially
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          await processImageUpload(itemId, file, files)
        }
      }
    } catch (error: any) {
      console.error('Error adding image:', error)

      // Handle cancel/timeout gracefully - don't show error for user cancellation
      if (error.message?.includes('timeout') || error.message?.includes('canceled')) {
        console.log('User canceled image selection or selection timed out')
        return
      }

      // Show error for actual failures
      showError('Failed to add image. Please try again.')
    } finally {
      setUploadingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  const processImageUpload = async (itemId: string, file: File, allFiles?: File[]) => {
    const uploadResult = await ImageUploadService.uploadItemImage(
      file,
      projectName,
      itemId
    )

    const newImage: ItemImage = {
      url: uploadResult.url,
      alt: file.name,
      isPrimary: true, // First image is always primary when added from list
      uploadedAt: new Date(),
      fileName: file.name,
      size: file.size,
      mimeType: file.type
    }

    // Update the item with the new image
    await itemService.addItemImage(projectId, itemId, newImage)
    // The real-time listener will handle the UI update

    // Show success notification on the last file
    if (allFiles && allFiles.indexOf(file) === allFiles.length - 1) {
      const message = allFiles.length > 1 ? `${allFiles.length} images uploaded successfully!` : 'Image uploaded successfully!'
      showSuccess(message)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return

    const confirmMessage = `Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone.`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const deletePromises = Array.from(selectedItems).map(itemId =>
        itemService.deleteItem(projectId, itemId)
      )

      await Promise.all(deletePromises)
      setSelectedItems(new Set())
      setError(null)
    } catch (error) {
      console.error('Failed to delete items:', error)
      setError('Failed to delete some items. Please try again.')
    }
  }

  const filteredItems = items.filter(item =>
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.payment_method.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <Link
          to={`/project/${projectId}/item/add`}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Link>
      </div>

      {/* Search and Controls */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Select All and Bulk Actions */}
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg">
          {/* Select All */}
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              onChange={(e) => handleSelectAll(e.target.checked)}
              checked={selectedItems.size === items.length && items.length > 0}
            />
            <span className="ml-3 text-sm font-medium text-gray-700">Select all</span>
          </label>

          {/* Right section - counter and buttons */}
          <div className="flex items-center gap-3">
            {/* Counter (when visible) */}
            {selectedItems.size > 0 && (
              <span className="text-sm text-gray-500">
                {selectedItems.size} of {items.length} selected
              </span>
            )}

            {/* Bulk action buttons */}
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
                disabled={selectedItems.size === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                QR
              </button>

              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center justify-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                disabled={selectedItems.size === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 px-4">
          <div className="mx-auto h-16 w-16 text-gray-400 animate-spin mb-4">
            <svg fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading inventory...</h3>
          <p className="text-sm text-gray-500">Fetching your project items.</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12 px-4">
          <div className="mx-auto h-16 w-16 text-red-400 mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-red-900 mb-2">Error loading inventory</h3>
          <p className="text-sm text-red-500 mb-6 max-w-sm mx-auto">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors duration-200 w-full sm:w-auto max-w-xs"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Retry
          </button>
        </div>
      )}

      {/* Items List */}
      {!loading && !error && filteredItems.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="mx-auto h-16 w-16 text-gray-400 mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No items found
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {searchQuery ? 'Try adjusting your search terms.' : 'Add your first item to this project inventory.'}
          </p>
          {!searchQuery && (
            <Link
              to={`/project/${projectId}/item/add`}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 w-full sm:w-auto max-w-xs"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Item
            </Link>
          )}
        </div>
      ) : (
        !loading && !error && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <li key={item.item_id} className="relative">
                  <div className="block bg-gray-50 transition-colors duration-200 hover:bg-gray-100 active:bg-gray-200">
                    <div className="px-4 py-4 sm:px-6">
                      {/* Top row: Controls */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 flex-shrink-0"
                            checked={selectedItems.has(item.item_id)}
                            onChange={(e) => handleSelectItem(item.item_id, e.target.checked)}
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleBookmark(item.item_id)
                            }}
                            className={`p-2 rounded-full transition-colors ${
                              item.bookmark
                                ? 'text-red-600 bg-red-50'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <Bookmark className="h-4 w-4" fill={item.bookmark ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleDisposition(item.item_id)
                            }}
                            className={`p-2 rounded-full transition-colors ${
                              item.disposition === 'return'
                                ? 'text-red-600 bg-red-50'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleAddImage(item.item_id)
                            }}
                            disabled={uploadingImages.has(item.item_id)}
                            className="p-2 rounded-full text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors disabled:opacity-50"
                            title="Add image (camera or gallery)"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDeleteItem(item.item_id)
                            }}
                            className="p-2 rounded-full text-red-600 hover:text-red-700 hover:bg-red-200 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom row: Content - Clickable */}
                      <Link
                        to={`/item/${item.item_id}?project=${projectId}`}
                        className="block"
                      >
                        <div className="space-y-2">
                          {/* Item description - no truncation */}
                          <h3 className="text-base font-medium text-gray-900">
                            {item.description}
                          </h3>

                          {/* Price, Source, SKU on same row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            {item.price && (
                              <span className="font-medium text-gray-700">${item.price}</span>
                            )}
                            {item.source && (
                              <>
                                {(item.price) && <span className="hidden sm:inline">•</span>}
                                <span className="font-medium text-gray-700">{item.source}</span>
                              </>
                            )}
                            {item.sku && (
                              <>
                                {(item.price || item.source) && <span className="hidden sm:inline">•</span>}
                                <span className="font-medium text-gray-700">{item.sku}</span>
                              </>
                            )}
                          </div>

                          {/* Notes - visible on mobile as last row */}
                          <div className="sm:hidden">
                            {item.notes && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {item.notes}
                              </p>
                            )}
                          </div>

                          {/* Additional info on larger screens */}
                          <div className="hidden sm:flex items-center text-sm text-gray-600">
                            {item.notes && (
                              <p className="truncate max-w-xs">{item.notes}</p>
                            )}
                          </div>

                        </div>
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  )
}
