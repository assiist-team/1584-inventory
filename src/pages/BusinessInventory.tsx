import { Plus, Search, Package, Receipt, Filter, QrCode, Trash2, Camera, Edit, Bookmark, Copy } from 'lucide-react'
import { useMemo } from 'react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Item, Transaction, ItemImage, Project } from '@/types'
import { unifiedItemsService, transactionService, projectService } from '@/services/inventoryService'
import { ImageUploadService } from '@/services/imageService'
import { formatCurrency, formatDate } from '@/utils/dateUtils'
import { useBookmark } from '@/hooks/useBookmark'
import { useDuplication } from '@/hooks/useDuplication'

interface FilterOptions {
  status?: string
  searchQuery?: string
}

export default function BusinessInventory() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions'>('inventory')
  const [items, setItems] = useState<Item[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters] = useState<FilterOptions>({
    status: '',
    searchQuery: ''
  })
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('')
  const [transactionSearchQuery, setTransactionSearchQuery] = useState<string>('')

  // Filter state for transactions tab
  const [showTransactionFilterMenu, setShowTransactionFilterMenu] = useState(false)
  const [transactionFilterMode, setTransactionFilterMode] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all')

  // Image upload state
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())

  // Filter and selection state for inventory items (matching InventoryList.tsx)
  const [filterMode, setFilterMode] = useState<'all' | 'bookmarked'>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Batch allocation state
  const [projects, setProjects] = useState<Project[]>([])
  const [showBatchAllocationModal, setShowBatchAllocationModal] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [batchAllocationForm, setBatchAllocationForm] = useState({
    projectId: '',
    space: ''
  })
  const [isAllocating, setIsAllocating] = useState(false)

  // Close filter menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if ((showFilterMenu || showTransactionFilterMenu) && !event.target) return

      const target = event.target as Element
      if (!target.closest('.filter-menu') && !target.closest('.filter-button') && !target.closest('.transaction-filter-menu') && !target.closest('.transaction-filter-button')) {
        setShowFilterMenu(false)
        setShowTransactionFilterMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterMenu, showTransactionFilterMenu])

  // Compute filtered items (matching InventoryList.tsx)
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Apply search filter
      const matchesSearch = !inventorySearchQuery ||
        item.description?.toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
        item.business_inventory_location?.toLowerCase().includes(inventorySearchQuery.toLowerCase())

      // Apply status filter
      const matchesStatus = !filters.status || item.inventory_status === filters.status

      // Apply bookmark filter
      const matchesFilter = filterMode === 'all' || (filterMode === 'bookmarked' && item.bookmark)

      return matchesSearch && matchesStatus && matchesFilter
    })
  }, [items, inventorySearchQuery, filters.status, filterMode])

  // Compute filtered transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    // Apply status filter based on filter mode
    if (transactionFilterMode !== 'all') {
      filtered = filtered.filter(t => t.status === transactionFilterMode)
    }

    // Apply search filter
    if (transactionSearchQuery) {
      const query = transactionSearchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.source?.toLowerCase().includes(query) ||
        t.transaction_type?.toLowerCase().includes(query) ||
        t.project_name?.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [transactions, transactionFilterMode, transactionSearchQuery])

  const tabs = [
    { id: 'inventory' as const, name: 'Items', icon: Package },
    { id: 'transactions' as const, name: 'Transactions', icon: Receipt }
  ]

  useEffect(() => {
    loadBusinessInventory()
    loadBusinessTransactions()
    loadProjects()
  }, [])

  // Subscribe to real-time updates for inventory
  useEffect(() => {
    const unsubscribe = unifiedItemsService.subscribeToBusinessInventory(
      (updatedItems) => {
        setItems(updatedItems)
        setIsLoading(false)
      },
      filters
    )

    return unsubscribe
  }, [filters])

  // Subscribe to real-time updates for transactions when on transactions tab
  useEffect(() => {
    if (activeTab !== 'transactions') return

    const loadTransactionsOnTabChange = async () => {
      await loadBusinessTransactions()
    }

    loadTransactionsOnTabChange()
  }, [activeTab])

  // Reset uploading state on unmount to prevent hanging state
  useEffect(() => {
    return () => {
      setUploadingImages(new Set())
    }
  }, [])

  const loadBusinessInventory = async () => {
    try {
      const data = await unifiedItemsService.getBusinessInventoryItems(filters)
      setItems(data)
    } catch (error) {
      console.error('Error loading business inventory:', error)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }


  const loadBusinessTransactions = async () => {
    try {
      // Get all projects first
      const projects = await projectService.getProjects()

      // Collect all transactions from all projects that are inventory-related
      const allTransactions: Transaction[] = []

      for (const project of projects) {
        try {
          const projectTransactions = await transactionService.getTransactions(project.id)
          // Filter for inventory-related transactions (those with reimbursement_type or trigger_event related to inventory)
          const inventoryTransactions = projectTransactions.filter(t =>
            t.reimbursement_type ||
            t.trigger_event === 'Inventory allocation' ||
            t.trigger_event === 'Inventory return' ||
            t.trigger_event === 'Purchase from client' ||
            t.source?.toLowerCase().includes('inventory')
          )
          allTransactions.push(...inventoryTransactions)
        } catch (error) {
          console.error(`Error loading transactions for project ${project.id}:`, error)
        }
      }

      // Sort by creation date, newest first
      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setTransactions(allTransactions)
    } catch (error) {
      console.error('Error loading business transactions:', error)
      setTransactions([])
    }
  }

  const loadProjects = async () => {
    try {
      const projectsData = await projectService.getProjects()
      setProjects(projectsData)
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const handleInventorySearchChange = (searchQuery: string) => {
    setInventorySearchQuery(searchQuery)
  }

  // Use centralized bookmark hook
  const { toggleBookmark } = useBookmark<Item>({
    items,
    setItems,
    updateItemService: unifiedItemsService.updateItem
  })

  // Use duplication hook for business inventory items
  const { duplicateItem } = useDuplication({
    items,
    setItems,
    duplicationService: async (itemId: string) => {
      // Since we're using the unified service, we need to create a duplicate item
      const originalItem = await unifiedItemsService.getItemById(itemId)
      if (!originalItem) throw new Error('Item not found')

      // Create a new item with similar data but new ID
      const { item_id, date_created, last_updated, ...itemData } = originalItem
      return await unifiedItemsService.createItem({
        ...itemData,
        inventory_status: 'available',
        project_id: null
      })
    }
  })

  // Batch allocation functions
  const openBatchAllocationModal = () => {
    setShowBatchAllocationModal(true)
  }

  const closeBatchAllocationModal = () => {
    setShowBatchAllocationModal(false)
    setShowProjectDropdown(false)
    setBatchAllocationForm({
      projectId: '',
      space: ''
    })
  }

  const getSelectedProjectName = () => {
    const selectedProject = projects.find(p => p.id === batchAllocationForm.projectId)
    return selectedProject ? `${selectedProject.name} - ${selectedProject.clientName}` : 'Select a project...'
  }

  const handleBatchAllocationSubmit = async () => {
    if (!batchAllocationForm.projectId || selectedItems.size === 0) return

    setIsAllocating(true)
    try {
      const itemIds = Array.from(selectedItems)
      await unifiedItemsService.batchAllocateItemsToProject(
        itemIds,
        batchAllocationForm.projectId,
        {
          space: batchAllocationForm.space
        }
      )

      // Clear selections and close modal
      setSelectedItems(new Set())
      closeBatchAllocationModal()

      // Show success message
      alert(`Successfully allocated ${itemIds.length} items to project!`)

      // Items will be updated via real-time subscription
    } catch (error) {
      console.error('Error batch allocating items:', error)
      alert('Error allocating items. Please try again.')
    } finally {
      setIsAllocating(false)
    }
  }

  // Image handling functions
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
      alert('Failed to add image. Please try again.')
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
      'Business Inventory',
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
    await unifiedItemsService.updateItem(itemId, { images: [newImage] })

    // Show success notification on the last file
    if (allFiles && allFiles.indexOf(file) === allFiles.length - 1) {
      const message = allFiles.length > 1 ? `${allFiles.length} images uploaded successfully!` : 'Image uploaded successfully!'
      alert(message)
    }
  }


  // Filter handlers (matching InventoryList.tsx)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(filteredItems.map(item => item.item_id)))
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">1584 Inventory</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-base flex items-center ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>


        {/* Tab Content */}
        <div className="px-6 py-6">
          {activeTab === 'inventory' && (
            <>
              {/* Header - Just Add Item button */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                <Link
                  to="/business-inventory/add?returnTo=/business-inventory"
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Link>
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
                      placeholder="Search items by description, SKU, or location..."
                      value={inventorySearchQuery || ''}
                      onChange={(e) => handleInventorySearchChange(e.target.value)}
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
                checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
              />
              <span className="ml-3 text-sm font-medium text-gray-700">Select all</span>
            </label>

            {/* Right section - counter and buttons */}
            <div className="flex items-center gap-3">

              {/* Bulk action buttons */}
              <div className="flex items-center space-x-2">
                {/* Filter Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className="filter-button inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                    title="Filter items"
                  >
                    <Filter className="h-4 w-4" />
                  </button>

                  {/* Filter Dropdown Menu */}
                  {showFilterMenu && (
                    <div className="filter-menu absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
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
                          Bookmarked Only
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Allocate to Project Button */}
                <button
                  onClick={openBatchAllocationModal}
                  className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                  disabled={selectedItems.size === 0}
                  title="Allocate selected items to project"
                >
                  <Plus className="h-4 w-4" />
                </button>

                <button
                  className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
                  disabled={selectedItems.size === 0}
                  title="Generate QR Codes"
                >
                  <QrCode className="h-4 w-4" />
                </button>

                <button
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

              {/* Items List */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="mx-auto h-16 w-16 text-gray-400 -mb-1">📦</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No items found
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {inventorySearchQuery || filters.status || filterMode === 'bookmarked'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'No items found.'
                    }
                  </p>
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {filteredItems.map((item) => (
                      <li key={item.item_id} className="relative bg-gray-50 transition-colors duration-200 hover:bg-gray-100">
                        {/* Top row: Controls - stays outside Link */}
                        <div className="flex items-center justify-between mb-0 px-4 py-3">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 flex-shrink-0"
                              checked={selectedItems.has(item.item_id)}
                              onChange={(e) => handleSelectItem(item.item_id, e.target.checked)}
                            />
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              className={`inline-flex items-center justify-center p-2 border text-sm font-medium rounded-md transition-colors ${
                                item.bookmark
                                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                              title={item.bookmark ? 'Remove Bookmark' : 'Add Bookmark'}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleBookmark(item.item_id)
                              }}
                            >
                              <Bookmark className="h-4 w-4" fill={item.bookmark ? 'currentColor' : 'none'} />
                            </button>
                            <Link
                              to={`/business-inventory/${item.item_id}/edit?returnTo=/business-inventory`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                              title="Edit item"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                duplicateItem(item.item_id)
                              }}
                              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                              title="Duplicate item"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            {/* Status badge moved to top-right corner */}
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              item.inventory_status === 'available'
                                ? 'bg-green-100 text-green-800'
                                : item.inventory_status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.inventory_status === 'available' ? 'Available' :
                               item.inventory_status === 'pending' ? 'Allocated' : 'Sold'}
                            </span>
                          </div>
                        </div>

                        {/* Main tappable content - wrapped in Link */}
                        <Link to={`/business-inventory/${item.item_id}`}>
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
                                        handleAddImage(item.item_id)
                                      }}
                                      disabled={uploadingImages.has(item.item_id)}
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
                                    {/* Storage Location field */}
                                    {item.business_inventory_location && (
                                      <p className="text-sm text-gray-600 mt-1">
                                        {item.business_inventory_location}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom row: Content - now tappable */}
                              <div className="space-y-2">
                                {/* Project Price (or Purchase Price if project price not set), Source, SKU on same row */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                                  {(item.project_price || item.purchase_price) && (
                                    <span className="font-medium text-gray-700">${item.project_price || item.purchase_price}</span>
                                  )}
                                  {item.source && (
                                    <>
                                      {(item.project_price || item.purchase_price) && <span className="hidden sm:inline">•</span>}
                                      <span className="font-medium text-gray-700">{item.source}</span>
                                    </>
                                  )}
                                  {item.sku && (
                                    <>
                                      {(item.project_price || item.purchase_price || item.source) && <span className="hidden sm:inline">•</span>}
                                      <span className="font-medium text-gray-700">{item.sku}</span>
                                    </>
                                  )}
                                </div>

                                {/* Notes */}
                                {item.notes && (
                                  <p className="text-sm text-gray-600 line-clamp-2">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {activeTab === 'transactions' && (
            <>
              {/* Header - Add Transaction button */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                <Link
                  to="/business-inventory/transactions/add"
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Link>
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
                      placeholder="Search transactions by source, type, project, or notes..."
                      value={transactionSearchQuery || ''}
                      onChange={(e) => setTransactionSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Filter Controls */}
                  <div className="flex items-center justify-end gap-4 p-3 rounded-lg">
                    {/* Filter Button */}
                    <div className="relative">
                      <button
                        onClick={() => setShowTransactionFilterMenu(!showTransactionFilterMenu)}
                        className={`transaction-filter-button inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-md transition-colors duration-200 ${
                          transactionFilterMode === 'all'
                            ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                            : 'border-primary-500 text-primary-600 bg-primary-50 hover:bg-primary-100'
                        }`}
                        title="Filter transactions"
                      >
                        <Filter className="h-4 w-4" />
                      </button>

                      {/* Transaction Filter Dropdown Menu */}
                      {showTransactionFilterMenu && (
                        <div className="transaction-filter-menu absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setTransactionFilterMode('all')
                                setShowTransactionFilterMenu(false)
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                transactionFilterMode === 'all' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                              }`}
                            >
                              All Status
                            </button>
                            <button
                              onClick={() => {
                                setTransactionFilterMode('pending')
                                setShowTransactionFilterMenu(false)
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                transactionFilterMode === 'pending' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                              }`}
                            >
                              Pending
                            </button>
                            <button
                              onClick={() => {
                                setTransactionFilterMode('completed')
                                setShowTransactionFilterMenu(false)
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                transactionFilterMode === 'completed' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                              }`}
                            >
                              Completed
                            </button>
                            <button
                              onClick={() => {
                                setTransactionFilterMode('cancelled')
                                setShowTransactionFilterMenu(false)
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                transactionFilterMode === 'cancelled' ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                              }`}
                            >
                              Cancelled
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="mx-auto h-16 w-16 text-gray-400 -mb-1">🧾</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No transactions found
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {transactionSearchQuery || transactionFilterMode !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'No inventory-related transactions found.'
                    }
                  </p>
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => (
                      <li key={transaction.transaction_id} className="relative">
                        <Link to={`/business-inventory/transaction/${transaction.transaction_id}`}>
                          <div className="block bg-gray-50 transition-colors duration-200 hover:bg-gray-100">
                            <div className="px-4 py-4 sm:px-6">
                            {/* Top row: Header with source and status */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center">
                                <h3 className="text-base font-medium text-gray-900">
                                  {transaction.source}
                                </h3>
                              </div>
                              <div className="flex items-center flex-wrap gap-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium no-icon ${
                                  transaction.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : transaction.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.status === 'completed' ? 'Completed' :
                                   transaction.status === 'pending' ? 'Pending' :
                                   transaction.status === 'cancelled' ? 'Cancelled' :
                                   transaction.status}
                                </span>
                              </div>
                            </div>

                            {/* Bottom row: Details */}
                            <div className="space-y-2">
                              {/* Details row - Price, project, date */}
                              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                <span className="font-medium text-gray-700">{formatCurrency(transaction.amount)}</span>
                                {transaction.project_name && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="font-medium text-gray-700">
                                      {transaction.project_name}
                                    </span>
                                  </>
                                )}
                                <span className="hidden sm:inline">•</span>
                                <span className="font-medium text-gray-700">
                                  {formatDate(transaction.transaction_date)}
                                </span>
                              </div>

                              {/* Notes */}
                              {transaction.notes && (
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  {transaction.notes}
                                </p>
                              )}

                            </div>

                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Batch Allocation Modal */}
      {showBatchAllocationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Allocate {selectedItems.size} Items to Project
              </h3>

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
                      <span className={`block truncate ${!batchAllocationForm.projectId ? 'text-gray-500' : 'text-gray-900'}`}>
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
                              setBatchAllocationForm(prev => ({ ...prev, projectId: project.id }))
                              setShowProjectDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                              batchAllocationForm.projectId === project.id ? 'bg-primary-50 text-primary-600' : 'text-gray-900'
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

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Space (Optional)
                  </label>
                  <input
                    type="text"
                    value={batchAllocationForm.space}
                    onChange={(e) => setBatchAllocationForm(prev => ({ ...prev, space: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="e.g. Living Room, Bedroom, etc."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeBatchAllocationModal}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBatchAllocationSubmit}
                  disabled={!batchAllocationForm.projectId || isAllocating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {isAllocating ? 'Allocating...' : `Allocate ${selectedItems.size} Items`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
