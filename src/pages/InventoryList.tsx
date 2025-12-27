import { useState, useEffect } from 'react'
import { Plus, Search, Bookmark, RotateCcw, Camera, ChevronDown, Edit, Trash2, QrCode, Filter, Copy } from 'lucide-react'
import { Link } from 'react-router-dom'
import ContextLink from '@/components/ContextLink'
import { unifiedItemsService, integrationService } from '@/services/inventoryService'
import { lineageService } from '@/services/lineageService'
import { ImageUploadService } from '@/services/imageService'
import { Item, ItemImage } from '@/types'
import { normalizeDisposition, dispositionsEqual, displayDispositionLabel } from '@/utils/dispositionUtils'
import { useToast } from '@/components/ui/ToastContext'
import { useBookmark } from '@/hooks/useBookmark'
import { useDuplication } from '@/hooks/useDuplication'
import { useNavigationContext } from '@/hooks/useNavigationContext'
import { useAccount } from '@/contexts/AccountContext'

interface InventoryListProps {
  projectId: string
  projectName: string
  items: Item[]
}

export default function InventoryList({ projectId, projectName, items: propItems }: InventoryListProps) {
  const { currentAccountId, loading: accountLoading } = useAccount()
  const ENABLE_QR = import.meta.env.VITE_ENABLE_QR === 'true'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [items, setItems] = useState<Item[]>(propItems || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Show loading spinner only if account is loading - items come from props (parent handles that loading)
  const isLoading = accountLoading
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())
  const [openDispositionMenu, setOpenDispositionMenu] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'bookmarked' | 'to-inventory' | 'from-inventory'>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const { showSuccess, showError } = useToast()

  // Debug logging
  useEffect(() => {
    console.log('🔍 InventoryList - accountLoading:', accountLoading, 'propItems length:', propItems?.length || 0, 'isLoading:', isLoading)
  }, [accountLoading, propItems, isLoading])

  useEffect(() => {
    console.log('🔍 InventoryList - propItems changed:', propItems?.length || 0)
    setItems(propItems || [])
  }, [propItems])

  // Per-visible-item lineage subscriptions: when an item has a lineage edge, refetch that item and update/remove as needed
  useEffect(() => {
    if (!currentAccountId || items.length === 0) return

    const unsubMap = new Map<string, () => void>()
    try {
      items.forEach(item => {
        if (!item?.itemId) return
        const unsub = lineageService.subscribeToItemLineageForItem(currentAccountId, item.itemId, async () => {
          try {
            const updated = await unifiedItemsService.getItemById(currentAccountId, item.itemId)
            if (updated) {
              // If updated item still belongs to this project, update it; otherwise remove it from the list
              if (updated.projectId === projectId) {
                setItems(prev => prev.map(i => i.itemId === updated.itemId ? updated : i))
              } else {
                setItems(prev => prev.filter(i => i.itemId !== updated.itemId))
              }
            }
          } catch (err) {
            console.debug('InventoryList - failed to refetch item on lineage event', err)
          }
        })
        unsubMap.set(item.itemId, unsub)
      })
    } catch (err) {
      console.debug('InventoryList - failed to setup per-item lineage subscriptions', err)
    }

    return () => {
      unsubMap.forEach(u => {
        try { u() } catch (e) { /* noop */ }
      })
    }
  }, [items.map(i => i.itemId).join(','), currentAccountId, projectId])

 

  // Reset uploading state on unmount to prevent hanging state
  useEffect(() => {
    return () => {
      setUploadingImages(new Set())
    }
  }, [])

  // Close disposition menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDispositionMenu && !event.target) return

      const target = event.target as Element
      if (!target.closest('.disposition-menu') && !target.closest('.disposition-badge')) {
        setOpenDispositionMenu(null)
      }
      if (showFilterMenu && !target.closest('.filter-menu') && !target.closest('.filter-button')) {
        setShowFilterMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDispositionMenu, showFilterMenu])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(item => item.itemId)))
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

  // Use centralized bookmark hook
  const { toggleBookmark } = useBookmark<Item>({
    items,
    setItems,
    updateItemService: (itemId, updates) => {
      if (!currentAccountId) throw new Error('Account ID is required')
      return unifiedItemsService.updateItem(currentAccountId, itemId, updates)
    },
    projectId
  })

  // Use centralized duplication hook
  const { duplicateItem } = useDuplication({
    items,
    setItems,
    projectId,
    accountId: currentAccountId || undefined
  })

  // Use navigation context for proper back navigation
  const { buildContextUrl } = useNavigationContext()

  const updateDisposition = async (itemId: string, newDisposition: string) => {
    console.log('🎯 InventoryList updateDisposition called:', itemId, newDisposition)

    try {
      const item = items.find((item: Item) => item.itemId === itemId)
      if (!item) {
        console.error('❌ Item not found for disposition update:', itemId)
        return
      }

      console.log('📝 Updating disposition from', item.disposition, 'to', newDisposition)

      // Update in Supabase
      if (!currentAccountId) throw new Error('Account ID is required')
      await unifiedItemsService.updateItem(currentAccountId, itemId, { disposition: newDisposition })
      console.log('💾 Database updated successfully')

      // If disposition is set to 'inventory', trigger deallocation process
      if (newDisposition === 'inventory') {
        console.log('🚀 Starting deallocation process for item:', itemId)
        try {
          await integrationService.handleItemDeallocation(
            currentAccountId,
            itemId,
            item.projectId || '',
            newDisposition
          )
          console.log('✅ Deallocation completed successfully')
          // Close the disposition menu - real-time subscription will handle state update
          setOpenDispositionMenu(null)
        } catch (deallocationError) {
          console.error('❌ Failed to handle deallocation:', deallocationError)
          // Revert the disposition change if deallocation fails
          await unifiedItemsService.updateItem(currentAccountId, itemId, {
            disposition: item.disposition // Revert to previous disposition
          })
          setError('Failed to move item to inventory. Please try again.')
          return
        }
      } else {
        // For non-inventory dispositions, update local state optimistically
        setItems(items.map(item =>
          item.itemId === itemId
            ? { ...item, disposition: newDisposition }
            : item
        ))

        // Close the disposition menu
        setOpenDispositionMenu(null)
      }
    } catch (error) {
      console.error('❌ Failed to update disposition:', error)
      setError('Failed to update item disposition. Please try again.')
    }
  }

  const toggleDispositionMenu = (itemId: string) => {
    setOpenDispositionMenu(openDispositionMenu === itemId ? null : itemId)
  }

  const getDispositionBadgeClasses = (disposition?: string) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors hover:opacity-80'
    const d = normalizeDisposition(disposition)

    switch (d) {
      case 'keep':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'to return':
        return `${baseClasses} bg-red-100 text-red-700`
      case 'returned':
        return `${baseClasses} bg-red-800 text-red-100`
      case 'inventory':
        return `${baseClasses} bg-primary-100 text-primary-600`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
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
    if (!currentAccountId) throw new Error('Account ID is required')
    await unifiedItemsService.updateItem(currentAccountId, itemId, { images: [newImage] })
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

    if (!currentAccountId) {
      setError('Account ID is required')
      return
    }
    try {
      const deletePromises = Array.from(selectedItems).map(itemId =>
        unifiedItemsService.deleteItem(currentAccountId, itemId)
      )

      await Promise.all(deletePromises)
      setSelectedItems(new Set())
      setError(null)
    } catch (error) {
      console.error('Failed to delete items:', error)
      setError('Failed to delete some items. Please try again.')
    }
  }

  const filteredItems = items.filter(item => {
    // Apply search filter
    const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.paymentMethod?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.space && item.space.toLowerCase().includes(searchQuery.toLowerCase()))

    // Apply filter based on filterMode
    let matchesFilter = false
    switch (filterMode) {
      case 'all':
        matchesFilter = true
        break
      case 'bookmarked':
        matchesFilter = item.bookmark
        break
      case 'to-inventory':
        matchesFilter = item.disposition === 'inventory'
        break
      case 'from-inventory':
        matchesFilter = item.source === 'Inventory'
        break
      default:
        matchesFilter = true
    }

    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
        <ContextLink
          to={buildContextUrl(`/project/${projectId}/item/add`, { project: projectId })}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </ContextLink>
      </div>

      {/* Search and Controls - Sticky Container */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 pb-0 mb-2">
        <div className="space-y-0">
          {/* Search Bar */}
          <div className="relative pt-2">
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
              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className={`filter-button inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md transition-colors duration-200 ${
                    filterMode === 'all'
                      ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      : 'border-primary-500 text-primary-600 bg-primary-50 hover:bg-primary-100'
                  }`}
                  title="Filter items"
                >
                  <Filter className="h-4 w-4" />
                </button>

                {/* Filter Dropdown Menu */}
                {showFilterMenu && (
                  <div className="filter-menu absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setFilterMode('all')
                          setShowFilterMenu(false)
                        }}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          filterMode === 'all' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                        }`}
                      >
                        All Items
                      </button>
                      <button
                        onClick={() => {
                          setFilterMode('bookmarked')
                          setShowFilterMenu(false)
                        }}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          filterMode === 'bookmarked' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                        }`}
                      >
                        Bookmarked
                      </button>
                      <button
                        onClick={() => {
                          setFilterMode('to-inventory')
                          setShowFilterMenu(false)
                        }}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          filterMode === 'to-inventory' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                        }`}
                      >
                        To Inventory
                      </button>
                      <button
                        onClick={() => {
                          setFilterMode('from-inventory')
                          setShowFilterMenu(false)
                        }}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          filterMode === 'from-inventory' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                        }`}
                      >
                        From Inventory
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {ENABLE_QR && (
                <button
                  className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
                  disabled={selectedItems.size === 0}
                  title="Generate QR Codes"
                >
                  <QrCode className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center justify-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                disabled={selectedItems.size === 0}
                title="Delete All"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Loading State */}
      {isLoading && (
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
      {!isLoading && !error && filteredItems.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="mx-auto h-16 w-16 text-gray-400 -mb-1">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No items yet
          </h3>
        </div>
      ) : (
        !isLoading && !error && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <li key={item.itemId} className="relative bg-gray-50 transition-colors duration-200 hover:bg-gray-100">
                  {/* Top row: Controls - stays outside Link */}
                  <div className="flex items-center justify-between mb-0 px-4 py-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 flex-shrink-0"
                        checked={selectedItems.has(item.itemId)}
                        onChange={(e) => handleSelectItem(item.itemId, e.target.checked)}
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleBookmark(item.itemId)
                        }}
                        className={`inline-flex items-center justify-center p-2 border text-sm font-medium rounded-md transition-colors ${
                          item.bookmark
                            ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                            : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                        title={item.bookmark ? 'Remove Bookmark' : 'Add Bookmark'}
                      >
                        <Bookmark className="h-4 w-4" fill={item.bookmark ? 'currentColor' : 'none'} />
                      </button>
                      <ContextLink
                        to={buildContextUrl(`/project/${projectId}/edit-item/${item.itemId}`, { project: projectId })}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                        title="Edit item"
                      >
                        <Edit className="h-4 w-4" />
                      </ContextLink>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          duplicateItem(item.itemId)
                        }}
                        className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                        title="Duplicate item"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                        <div className="relative ml-1">
                          <span
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleDispositionMenu(item.itemId)
                            }}
                          className={`disposition-badge ${getDispositionBadgeClasses(item.disposition)}`}
                        >
                          {displayDispositionLabel(item.disposition) || 'Not Set'}
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </span>

                          {/* Dropdown menu */}
                          {openDispositionMenu === item.itemId && (
                            <div className="disposition-menu absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                              <div className="py-1">
                                {['keep', 'to return', 'returned', 'inventory'].map((disposition) => (
                                  <button
                                    key={disposition}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      updateDisposition(item.itemId, disposition)
                                    }}
                                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                                      dispositionsEqual(item.disposition, disposition) ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                    }`}
                                    disabled={!item.disposition}
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

                  {/* Main tappable content - wrapped in Link */}
                  <ContextLink to={buildContextUrl(`/item/${item.itemId}`, { project: projectId })}>
                    <div className="block bg-transparent">
                      <div className="px-4 pb-3 sm:px-6">
                        {/* Middle row: Thumbnail and Description - now tappable */}
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex-shrink-0">
                            {item.images && item.images.length > 0 ? (
                              // Show primary image thumbnail or first image if no primary
                              (() => {
                                const primaryImage = item.images.find(img => img.isPrimary) || item.images[0]
                                return (
                                  <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200">
                                    <img
                                      src={primaryImage.url}
                                      alt={primaryImage.alt || 'Item image'}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )
                              })()
                            ) : (
                              // Show camera placeholder when no images
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleAddImage(item.itemId)
                                }}
                                disabled={uploadingImages.has(item.itemId)}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors disabled:opacity-50"
                                title="Add image (camera or gallery)"
                              >
                                <Camera className="h-6 w-6" />
                              </button>
                            )}
                          </div>

                          {/* Item description - now tappable */}
                          <div className="flex-1 min-w-0 flex items-center">
                            <div>
                              <h3 className="text-base font-medium text-gray-900 line-clamp-2 break-words">
                                {item.description}
                              </h3>
                              {/* Space field */}
                              {item.space && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {item.space}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: Content - now tappable */}
                        <div className="space-y-2">
                          {/* Project Price (or Purchase Price if project price not set), Source, SKU on same row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            {(item.projectPrice || item.purchasePrice) && (
                              <span className="font-medium text-gray-700">${item.projectPrice || item.purchasePrice}</span>
                            )}
                            {item.source && (
                              <>
                                {(item.projectPrice || item.purchasePrice) && <span className="hidden sm:inline">•</span>}
                                <span className="font-medium text-gray-700">{item.source}</span>
                              </>
                            )}
                            {item.sku && (
                              <>
                                {(item.projectPrice || item.purchasePrice || item.source) && <span className="hidden sm:inline">•</span>}
                                <span className="font-medium text-gray-700">{item.sku}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ContextLink>
                </li>
              ))}
            </ul>
            
          </div>
        )
      )}
    </div>
  )
}

