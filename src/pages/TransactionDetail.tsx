import { ArrowLeft, Edit, Trash2, Image as ImageIcon, Package } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import ImageGallery from '@/components/ui/ImageGallery'
import { TransactionImagePreview } from '@/components/ui/ImagePreview'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Transaction, Project, Item, TransactionItemFormData, TaxPreset } from '@/types'
import { transactionService, projectService, unifiedItemsService } from '@/services/inventoryService'
import { ImageUploadService } from '@/services/imageService'
import { formatDate, formatCurrency } from '@/utils/dateUtils'
import { useToast } from '@/components/ui/ToastContext'
import TransactionItemForm from '@/components/TransactionItemForm'
import { useNavigationContext } from '@/hooks/useNavigationContext'
import { getTaxPresets } from '@/services/taxPresetsService'
import { useAccount } from '@/contexts/AccountContext'
import { COMPANY_INVENTORY_SALE, COMPANY_INVENTORY_PURCHASE, CLIENT_OWES_COMPANY, COMPANY_OWES_CLIENT } from '@/constants/company'
import TransactionAudit from '@/components/ui/TransactionAudit'

// Remove any unwanted icons from transaction type badges
const removeUnwantedIcons = () => {
  const badges = document.querySelectorAll('.no-icon')
  badges.forEach(badge => {
    // Remove any child elements that aren't text nodes
    const children = Array.from(badge.childNodes)
    children.forEach(child => {
      if (child.nodeType !== Node.TEXT_NODE) {
        if (child.parentNode) {
          child.parentNode.removeChild(child)
        }
      }
    })
  })
}

// Get canonical transaction title for display
const getCanonicalTransactionTitle = (transaction: Transaction): string => {
  // Check if this is a canonical inventory transaction
  if (transaction.transactionId?.startsWith('INV_SALE_')) {
    return COMPANY_INVENTORY_SALE
  }
  if (transaction.transactionId?.startsWith('INV_PURCHASE_')) {
    return COMPANY_INVENTORY_PURCHASE
  }
  // Return the original source for non-canonical transactions
  return transaction.source
}


export default function TransactionDetail() {
  const { id: projectId, transactionId } = useParams<{ id?: string; transactionId: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAccount()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([])

  // Load tax presets on mount
  useEffect(() => {
    const loadPresets = async () => {
      if (!currentAccountId) return
      try {
        const presets = await getTaxPresets(currentAccountId)
        setTaxPresets(presets)
      } catch (error) {
        console.error('Error loading tax presets:', error)
      }
    }
    loadPresets()
  }, [currentAccountId])
  const [transactionItems, setTransactionItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingItems, setIsLoadingItems] = useState(true)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const [isUploadingReceiptImages, setIsUploadingReceiptImages] = useState(false)
  const [isUploadingOtherImages, setIsUploadingOtherImages] = useState(false)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [imageFilesMap, setImageFilesMap] = useState<Map<string, File[]>>(new Map())
  const { showError, showSuccess } = useToast()
  const { buildContextUrl, getBackDestination } = useNavigationContext()

  // Navigation context logic

  const backDestination = useMemo(() => {
    // Use navigation context's getBackDestination function
    return getBackDestination(`/project/${projectId}?tab=transactions`)
  }, [getBackDestination, projectId])

  // Refresh transaction items
  const refreshTransactionItems = async () => {
    if (!currentAccountId || !transactionId) return
    
    const actualProjectId = projectId || transaction?.projectId
    if (!actualProjectId) return

    try {
      const transactionItems = await unifiedItemsService.getItemsForTransaction(currentAccountId, actualProjectId, transactionId)
      const itemIds = transactionItems.map(item => item.itemId)
      const itemsPromises = itemIds.map(id => unifiedItemsService.getItemById(currentAccountId, id))
      const items = await Promise.all(itemsPromises)
      const validItems = items.filter(item => item !== null) as Item[]
      setTransactionItems(validItems)
    } catch (error) {
      console.error('Error refreshing transaction items:', error)
    }
  }

  useEffect(() => {
    const loadTransaction = async () => {
      if (!transactionId || !currentAccountId) return

      try {
        let actualProjectId = projectId
        let transactionData: any
        let projectData: Project | null = null

        if (!actualProjectId) {
          // For business inventory transactions, we need to find the transaction across all projects
          console.log('TransactionDetail - No projectId provided, searching across all projects for business inventory transaction')
          const result = await transactionService.getTransactionById(currentAccountId, transactionId)

          if (!result.transaction || !result.projectId) {
            console.error('TransactionDetail - Transaction not found in any project')
            setIsLoading(false)
            setIsLoadingItems(false)
            return
          }

          transactionData = result.transaction
          actualProjectId = result.projectId

          // Get project data for the found project
          projectData = await projectService.getProject(currentAccountId, actualProjectId)
        } else {
          // Fetch transaction, project data, and transaction items for regular project transactions
          const [fetchedTransactionData, fetchedProjectData, transactionItems] = await Promise.all([
            transactionService.getTransaction(currentAccountId, actualProjectId, transactionId),
            projectService.getProject(currentAccountId, actualProjectId),
            unifiedItemsService.getItemsForTransaction(currentAccountId, actualProjectId, transactionId)
          ])

          transactionData = fetchedTransactionData
          projectData = fetchedProjectData

          // Fetch the actual item details for regular project transactions
          if (transactionItems.length > 0 && actualProjectId) {
            const itemIds = transactionItems.map(item => item.itemId)
            const itemsPromises = itemIds.map(itemId => unifiedItemsService.getItemById(currentAccountId, itemId))
            const items = await Promise.all(itemsPromises)
            const validItems = items.filter(item => item !== null) as Item[]
            console.log('TransactionDetail - fetched items:', validItems.length)
            setTransactionItems(validItems)
          } else {
            setTransactionItems([])
          }
        }

        const convertedTransaction: Transaction = {
          ...transactionData,
          transactionImages: Array.isArray(transactionData?.transactionImages) ? transactionData.transactionImages : []
        } as Transaction

        console.log('TransactionDetail - loaded transactionData:', transactionData)
        console.log('TransactionDetail - convertedTransaction:', convertedTransaction)
        console.log('TransactionDetail - actualProjectId:', actualProjectId)
        setTransaction(convertedTransaction)
        setProject(projectData)

        // Fetch transaction items for business inventory transactions
        if (!projectId && actualProjectId) {
          // For business inventory transactions, fetch items after we have the project ID
            const transactionItems = await unifiedItemsService.getItemsForTransaction(currentAccountId, actualProjectId!, transactionId)
          if (transactionItems.length > 0) {
            const itemIds = transactionItems.map(item => item.itemId)
            const itemsPromises = itemIds.map(itemId => unifiedItemsService.getItemById(currentAccountId, itemId))
            const items = await Promise.all(itemsPromises)
            const validItems = items.filter(item => item !== null) as Item[]
            console.log('TransactionDetail - fetched items for business inventory transaction:', validItems.length)
            setTransactionItems(validItems)
          } else {
            setTransactionItems([])
          }
        }

      } catch (error) {
        console.error('Error loading transaction:', error)
        setTransactionItems([])
      } finally {
        setIsLoading(false)
        setIsLoadingItems(false)
      }
    }

    loadTransaction()
  }, [projectId, transactionId, currentAccountId])

  // Set up real-time subscription for transaction updates
  useEffect(() => {
    if (!transactionId || !transaction) return
    // Use the actual project ID (whether from URL params or discovered from transaction lookup)
    const actualProjectId = projectId || transaction.projectId

    if (!actualProjectId) return

    // Temporarily disable real-time subscription to debug
    // const unsubscribe = transactionService.subscribeToTransaction(
    //   actualProjectId,
    //   transactionId,
    //   (updatedTransaction) => {
    //     if (updatedTransaction) {
    //       console.log('TransactionDetail - real-time updatedTransaction:', updatedTransaction)
    //       console.log('TransactionDetail - real-time updatedTransaction.transaction_images:', updatedTransaction.transaction_images)
    //       console.log('TransactionDetail - real-time updatedTransaction.transaction_images length:', updatedTransaction.transaction_images?.length)

    //       const convertedTransaction: Transaction = {
    //         ...updatedTransaction,
    //         transaction_images: Array.isArray(updatedTransaction.transaction_images) ? updatedTransaction.transaction_images : []
    //       } as Transaction

    //       console.log('TransactionDetail - real-time convertedTransaction:', convertedTransaction)
    //       setTransaction(convertedTransaction)
    //     } else {
    //       setTransaction(null)
    //     }
    //   }
    // )

    // return () => {
    //   unsubscribe()
    // }
  }, [projectId, transactionId, transaction])


  // Clean up any unwanted icons from transaction type badges
  useEffect(() => {
    if (transaction) {
      removeUnwantedIcons()
      // Also run after a short delay to catch any dynamically added icons
      const timer = setTimeout(removeUnwantedIcons, 100)
      const timer2 = setTimeout(removeUnwantedIcons, 500)
      return () => {
        clearTimeout(timer)
        clearTimeout(timer2)
      }
    }
  }, [transaction])

  const handleDelete = async () => {
    if (!projectId || !transactionId || !transaction || !currentAccountId) return

    if (window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      try {
        await transactionService.deleteTransaction(currentAccountId, projectId, transactionId)
        navigate(`/project/${projectId}?tab=transactions`)
      } catch (error) {
        console.error('Error deleting transaction:', error)
        showError('Failed to delete transaction. Please try again.')
      }
    }
  }

  const handleImageClick = (index: number) => {
    setGalleryInitialIndex(index)
    setShowGallery(true)
  }

  const handleGalleryClose = () => {
    setShowGallery(false)
  }

  const handleReceiptImagesUpload = async (files: File[]) => {
    if (!projectId || !transactionId || !project || files.length === 0) return

    setIsUploadingReceiptImages(true)

    try {
      // Upload receipt images
      const uploadResults = await ImageUploadService.uploadMultipleReceiptImages(
        files,
        project.name,
        transactionId
      )

      // Convert to TransactionImage format
      const newReceiptImages = ImageUploadService.convertFilesToReceiptImages(uploadResults)

      // Update transaction with new receipt images
      const currentReceiptImages = transaction?.receiptImages || []
      const updatedReceiptImages = [...currentReceiptImages, ...newReceiptImages]

      const updateProjectId = transaction?.projectId || projectId
      if (!currentAccountId) return
      await transactionService.updateTransaction(currentAccountId, updateProjectId || '', transactionId, {
        receiptImages: updatedReceiptImages,
        transactionImages: updatedReceiptImages // Also update legacy field for compatibility
      })

      // Refresh transaction data (use actual project_id from transaction)
      const refreshProjectId = transaction?.projectId || projectId
      const updatedTransaction = await transactionService.getTransaction(currentAccountId, refreshProjectId || '', transactionId)
      setTransaction(updatedTransaction)

      showSuccess('Receipt images uploaded successfully')
    } catch (error) {
      console.error('Error uploading receipt images:', error)
      showError('Failed to upload receipt images. Please try again.')
    } finally {
      setIsUploadingReceiptImages(false)
    }
  }

  const handleOtherImagesUpload = async (files: File[]) => {
    if (!projectId || !transactionId || !project || files.length === 0) return

    setIsUploadingOtherImages(true)

    try {
      // Upload other images
      const uploadResults = await ImageUploadService.uploadMultipleOtherImages(
        files,
        project.name,
        transactionId
      )

      // Convert to TransactionImage format
      const newOtherImages = ImageUploadService.convertFilesToOtherImages(uploadResults)

      // Update transaction with new other images
      const currentOtherImages = transaction?.otherImages || []
      const updatedOtherImages = [...currentOtherImages, ...newOtherImages]

      const updateProjectId = transaction?.projectId || projectId
      if (!currentAccountId) return
      await transactionService.updateTransaction(currentAccountId, updateProjectId || '', transactionId, {
        otherImages: updatedOtherImages
      })

      // Refresh transaction data (use actual project_id from transaction)
      const refreshProjectId = transaction?.projectId || projectId
      const updatedTransaction = await transactionService.getTransaction(currentAccountId, refreshProjectId || '', transactionId)
      setTransaction(updatedTransaction)

      showSuccess('Other images uploaded successfully')
    } catch (error) {
      console.error('Error uploading other images:', error)
      showError('Failed to upload other images. Please try again.')
    } finally {
      setIsUploadingOtherImages(false)
    }
  }

  const handleDeleteReceiptImage = async (imageUrl: string) => {
    if (!projectId || !transactionId || !transaction || !currentAccountId) return

    try {
      // Filter out the image to be deleted
      const currentReceiptImages = transaction.receiptImages || []
      const updatedReceiptImages = currentReceiptImages.filter(img => img.url !== imageUrl)

      const updateProjectId = transaction?.projectId || projectId
      await transactionService.updateTransaction(currentAccountId, updateProjectId || '', transactionId, {
        receiptImages: updatedReceiptImages,
        transactionImages: updatedReceiptImages // Also update legacy field for compatibility
      })

      // Refresh transaction data (use actual project_id from transaction)
      const refreshProjectId = transaction?.projectId || projectId
      const updatedTransaction = await transactionService.getTransaction(currentAccountId, refreshProjectId || '', transactionId)
      setTransaction(updatedTransaction)

      showSuccess('Receipt image deleted successfully')
    } catch (error) {
      console.error('Error deleting receipt image:', error)
      showError('Failed to delete receipt image. Please try again.')
    }
  }

  const handleDeleteOtherImage = async (imageUrl: string) => {
    if (!projectId || !transactionId || !transaction) return

    try {
      // Filter out the image to be deleted
      const currentOtherImages = transaction.otherImages || []
      const updatedOtherImages = currentOtherImages.filter(img => img.url !== imageUrl)

      const updateProjectId = transaction?.projectId || projectId
      if (!currentAccountId) return
      await transactionService.updateTransaction(currentAccountId, updateProjectId || '', transactionId, {
        otherImages: updatedOtherImages
      })

      // Refresh transaction data (use actual project_id from transaction)
      const refreshProjectId = transaction?.projectId || projectId
      const updatedTransaction = await transactionService.getTransaction(currentAccountId, refreshProjectId || '', transactionId)
      setTransaction(updatedTransaction)

      showSuccess('Other image deleted successfully')
    } catch (error) {
      console.error('Error deleting other image:', error)
      showError('Failed to delete other image. Please try again.')
    }
  }

  const handleImageFilesChange = (itemId: string, imageFiles: File[]) => {
    setImageFilesMap(prev => {
      const newMap = new Map(prev)
      newMap.set(itemId, imageFiles)
      return newMap
    })
  }

  const handleSaveItem = async (item: TransactionItemFormData) => {
    if (!projectId || !transactionId || !transaction || !currentAccountId) return

    try {
      // Create the item linked to the existing transaction
      const itemData = {
        ...item,
        projectId: projectId,
        transactionId: transactionId,
        dateCreated: transaction.transactionDate || new Date().toISOString(),
        source: transaction.source,
        inventoryStatus: 'available' as const,
        paymentMethod: 'Unknown',
        qrKey: `QR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        bookmark: false,
        sku: item.sku || '',
        purchasePrice: item.purchasePrice || '',
        projectPrice: item.projectPrice || '',
        marketValue: item.marketValue || '',
        notes: item.notes || '',
        space: item.space || '',
        disposition: 'keep'
      }
      const itemId = await unifiedItemsService.createItem(currentAccountId, itemData)

      // Upload item images if any
      // Try to get files from the map first, then fall back to item.imageFiles
      let imageFiles = imageFilesMap.get(item.id)
      if (!imageFiles && item.imageFiles) {
        imageFiles = item.imageFiles
      }

      if (imageFiles && imageFiles.length > 0) {
        try {
          const uploadedImages = await Promise.all(
            imageFiles.map(async (file, index) => {
              try {
                const uploadResult = await ImageUploadService.uploadItemImage(
                  file,
                  project ? project.name : 'Unknown Project',
                  itemId
                )

                return {
                  url: uploadResult.url,
                  alt: file.name,
                  isPrimary: index === 0, // First image is primary
                  uploadedAt: new Date(),
                  fileName: file.name,
                  size: file.size,
                  mimeType: file.type
                }
              } catch (uploadError) {
                console.error(`Failed to upload ${file.name}:`, uploadError)
                // Return a placeholder for failed uploads so the process continues
                return {
                  url: '',
                  alt: file.name,
                  isPrimary: false,
                  uploadedAt: new Date(),
                  fileName: file.name,
                  size: file.size,
                  mimeType: file.type
                }
              }
            })
          )

          // Filter out failed uploads (empty URLs)
          const validImages = uploadedImages.filter(img => img.url && img.url.trim() !== '')

          // Update the item with uploaded images
          if (validImages.length > 0) {
            await unifiedItemsService.updateItem(currentAccountId, itemId, { images: validImages })
          }
        } catch (error) {
          console.error('Error in image upload process:', error)
        }
      }

      // Refresh the transaction items list
      const transactionItems = await unifiedItemsService.getItemsForTransaction(currentAccountId, projectId, transactionId)
      const itemIds = transactionItems.map(item => item.itemId)
      const itemsPromises = itemIds.map(id => unifiedItemsService.getItemById(currentAccountId, id))
      const items = await Promise.all(itemsPromises)
      const validItems = items.filter(item => item !== null) as Item[]
      setTransactionItems(validItems)

      // Reset state
      setIsAddingItem(false)
      setImageFilesMap(new Map())

      showSuccess('Item added successfully')
    } catch (error) {
      console.error('Error adding item:', error)
      showError('Failed to add item. Please try again.')
    }
  }

  const handleCancelAddItem = () => {
    setIsAddingItem(false)
    setImageFilesMap(new Map())
  }

  // Convert all transaction images (receipt and other) to ItemImage format for the gallery
  const allTransactionImages = [
    ...(transaction?.receiptImages || []),
    ...(transaction?.otherImages || [])
  ]

    const itemImages = allTransactionImages.map((img, index) => ({
    url: img.url,
    alt: img.fileName,
    fileName: img.fileName,
    uploadedAt: img.uploadedAt,
    size: img.size,
    mimeType: img.mimeType,
    isPrimary: index === 0 // First image is primary
  })) || []

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

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400">📄</div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Transaction not found</h3>
        <p className="mt-1 text-sm text-gray-500">The transaction you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to={backDestination}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
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
          <Link
            to={backDestination}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
          <div className="flex space-x-3">
            <Link
              to={`/project/${projectId}/transaction/${transactionId}/edit`}
              className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              title="Edit Transaction"
            >
              <Edit className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {getCanonicalTransactionTitle(transaction)} - {formatCurrency(transaction.amount)}
          </h1>
        </div>


        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Transaction Details
          </h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Source</dt>
              <dd className="mt-1 text-sm text-gray-900">{transaction.source}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Budget Category</dt>
              <dd className="mt-1">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  transaction.budgetCategory === 'Design Fee'
                    ? 'bg-amber-100 text-amber-800'
                    : transaction.budgetCategory === 'Furnishings'
                    ? 'bg-yellow-100 text-yellow-800'
                    : transaction.budgetCategory === 'Property Management'
                    ? 'bg-orange-100 text-orange-800'
                    : transaction.budgetCategory === 'Kitchen'
                    ? 'bg-amber-200 text-amber-900'
                    : transaction.budgetCategory === 'Install'
                    ? 'bg-yellow-200 text-yellow-900'
                    : transaction.budgetCategory === 'Storage & Receiving'
                    ? 'bg-orange-200 text-orange-900'
                    : transaction.budgetCategory === 'Fuel'
                    ? 'bg-amber-300 text-amber-900'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {transaction.budgetCategory || 'Not specified'}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Transaction Type</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium no-icon ${
                  transaction.transactionType === 'Purchase'
                    ? 'bg-green-100 text-green-800'
                    : transaction.transactionType === 'Return'
                    ? 'bg-red-100 text-red-800'
                    : transaction.transactionType === 'To Inventory'
                    ? 'bg-primary-100 text-primary-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {transaction.transactionType}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Amount</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatCurrency(transaction.amount)}</dd>
            </div>

            {transaction.taxRatePreset && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Tax Rate Preset</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {transaction.taxRatePreset === 'Other' 
                    ? 'Custom'
                    : (() => {
                        const preset = taxPresets.find(p => p.id === transaction.taxRatePreset)
                        return preset ? `${preset.name} (${preset.rate.toFixed(2)}%)` : transaction.taxRatePreset
                      })()
                  }
                </dd>
              </div>
            )}

            {transaction.subtotal && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Subtotal</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatCurrency(transaction.subtotal)}</dd>
              </div>
            )}

            {transaction.taxRatePct !== undefined && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Tax Rate</dt>
                <dd className="mt-1 text-sm text-gray-900">{Number(transaction.taxRatePct).toFixed(2)}%</dd>
              </div>
            )}

            <div>
              <dt className="text-sm font-medium text-gray-500">Transaction Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {transaction.transactionDate ? formatDate(transaction.transactionDate) : 'No date'}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
              <dd className="mt-1 text-sm text-gray-900">{transaction.paymentMethod}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {(transaction.status || 'pending').charAt(0).toUpperCase() + (transaction.status || 'pending').slice(1)}
              </dd>
            </div>

            {transaction.reimbursementType && (transaction.reimbursementType as string) !== '' && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Reimbursement Type</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {transaction.reimbursementType === CLIENT_OWES_COMPANY ? CLIENT_OWES_COMPANY : COMPANY_OWES_CLIENT}
                </dd>
              </div>
            )}

            {transaction.receiptEmailed && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Receipt Emailed
                </dt>
                <dd className="mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Yes
                  </span>
                </dd>
              </div>
            )}

            {transaction.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Notes</dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{transaction.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Receipt Images */}
        <div className="px-6 py-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <ImageIcon className="h-5 w-5 mr-2" />
              Receipt Images
            </h3>
                {transaction.receiptImages && transaction.receiptImages.length > 0 && (
              <button
                onClick={() => {
                  // Trigger file input click programmatically
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                      handleReceiptImagesUpload(Array.from(files))
                    }
                  }
                  input.click()
                }}
                disabled={isUploadingReceiptImages}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                {isUploadingReceiptImages ? 'Uploading...' : 'Add Images'}
              </button>
            )}
          </div>
          {transaction.receiptImages && transaction.receiptImages.length > 0 ? (
            <TransactionImagePreview
              images={transaction.receiptImages}
              onRemoveImage={handleDeleteReceiptImage}
              onImageClick={handleImageClick}
              maxImages={5}
              showControls={true}
              size="md"
              className="mb-4"
            />
          ) : (
            <div className="text-center py-8">
              <ImageIcon className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No receipt images uploaded</h3>
              <button
                onClick={() => {
                  // Trigger file input click programmatically
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                      handleReceiptImagesUpload(Array.from(files))
                    }
                  }
                  input.click()
                }}
                disabled={isUploadingReceiptImages}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 mt-3 disabled:opacity-50"
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                {isUploadingReceiptImages ? 'Uploading...' : 'Add Receipt Images'}
              </button>
            </div>
          )}
        </div>

        {/* Other Images - Only show if there are other images */}
            {transaction.otherImages && transaction.otherImages.length > 0 && (
          <div className="px-6 py-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <ImageIcon className="h-5 w-5 mr-2" />
                Other Images
              </h3>
              <button
                onClick={() => {
                  // Trigger file input click programmatically
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                      handleOtherImagesUpload(Array.from(files))
                    }
                  }
                  input.click()
                }}
                disabled={isUploadingOtherImages}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                {isUploadingOtherImages ? 'Uploading...' : 'Add Images'}
              </button>
            </div>
            <TransactionImagePreview
              images={transaction.otherImages}
              onRemoveImage={handleDeleteOtherImage}
              onImageClick={(index) => {
                // Find the correct index in the combined array for gallery navigation
                const receiptCount = transaction.receiptImages?.length || 0
                const legacyCount = transaction.transactionImages?.length || 0
                const galleryIndex = receiptCount + legacyCount + index
                handleImageClick(galleryIndex)
              }}
              maxImages={5}
              showControls={true}
              size="md"
              className="mb-4"
            />

          </div>
        )}

        {/* Transaction Items */}
        <div className="px-6 py-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Transaction Items
            </h3>
            {/* Add Item Button - Only show when items exist (like Receipt Images section) */}
            {(!isLoadingItems && !isAddingItem && transactionItems.length > 0) && (
              <button
                onClick={() => setIsAddingItem(true)}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                title="Add new item"
              >
                <Package className="h-3 w-3 mr-1" />
                Add Item
              </button>
            )}
          </div>

          {isLoadingItems ? (
            <div className="flex justify-center items-center h-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading items...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Existing Items Display */}
              {transactionItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {transactionItems.map((item) => {
                    // Check if item has been deallocated to inventory (projectId is null)
                    const isDeallocated = item.projectId == null
                    const itemLink = isDeallocated
                      ? buildContextUrl(`/business-inventory/${item.itemId}`, { from: 'business-inventory-item' })
                      : buildContextUrl(`/project/${projectId}/item/${item.itemId}`, { from: 'transaction' })

                    return (
                      <Link
                        key={item.itemId}
                        to={itemLink}
                        className="block p-4 border border-gray-200 rounded-lg bg-white hover:border-primary-300 hover:shadow-sm transition-all duration-200 group relative"
                      >
                      {/* Disposition badge in upper right corner */}
                      {item.disposition && (
                        <div className="absolute top-1 right-1 z-10">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.disposition === 'keep'
                              ? 'bg-green-100 text-green-800'
                              : item.disposition === 'to return'
                              ? 'bg-red-100 text-red-700'
                              : item.disposition === 'return' // Backward compatibility
                              ? 'bg-red-100 text-red-700'
                              : item.disposition === 'returned'
                              ? 'bg-red-800 text-red-100'
                              : item.disposition === 'inventory'
                              ? 'bg-primary-100 text-primary-600'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.disposition === 'to return' ? 'To Return' : item.disposition ? item.disposition.charAt(0).toUpperCase() + item.disposition.slice(1) : 'Not Set'}
                          </span>
                        </div>
                      )}

                      {/* Image and Description row - side by side like inventory list */}
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
                            // Show placeholder when no images
                            <div className="w-16 h-16 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-400 bg-gray-100">
                              <Package className="h-6 w-6" />
                            </div>
                          )}
                        </div>

                        {/* Item description - matching inventory list styling */}
                        <div className="flex-1 min-w-0 flex items-center">
                          <div>
                            <h3 className="text-base font-medium text-gray-900 line-clamp-2 break-words">
                              {item.description}
                            </h3>
                            {/* Space field - if available */}
                            {item.space && (
                              <p className="text-sm text-gray-600 mt-1">
                                {item.space}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom row: Price, Source, SKU - exactly like inventory list */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        {(item.projectPrice || item.purchasePrice) && (
                          <span className="font-medium text-gray-700">{formatCurrency(item.projectPrice || item.purchasePrice || '0')}</span>
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
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* In-line Item Addition */}
              {isAddingItem && (
                <TransactionItemForm
                  onSave={handleSaveItem}
                  onCancel={handleCancelAddItem}
                  projectId={projectId}
                  projectName={project ? project.name : ''}
                  onImageFilesChange={handleImageFilesChange}
                />
              )}

              {/* Empty State - Only show when no items exist and not adding */}
              {transactionItems.length === 0 && !isAddingItem && (
                <div className="text-center py-8">
                  <Package className="mx-auto h-8 w-8 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No items added</h3>
                  <button
                    onClick={() => setIsAddingItem(true)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 mt-3"
                    title="Add new item"
                  >
                    <Package className="h-3 w-3 mr-1" />
                    Add Item
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transaction Audit */}
        {transaction && (projectId || transaction.projectId) && getCanonicalTransactionTitle(transaction) !== COMPANY_INVENTORY_SALE && getCanonicalTransactionTitle(transaction) !== COMPANY_INVENTORY_PURCHASE && (
          <div className="px-6 py-6 border-t border-gray-200">
            <TransactionAudit
              transaction={transaction}
              projectId={projectId || transaction.projectId || ''}
              transactionItems={transactionItems}
              onItemsUpdated={refreshTransactionItems}
            />
          </div>
        )}

        {/* Metadata */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="relative">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project</dt>
                <dd className="mt-1 text-sm text-gray-900">{project?.name || transaction.projectName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(transaction.createdAt)}
                </dd>
              </div>
            </dl>

            {/* Delete button in lower right corner */}
            <div className="absolute bottom-0 right-0">
              <button
                onClick={handleDelete}
                className="inline-flex items-center justify-center p-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                title="Delete Transaction"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image gallery modal */}
      {showGallery && (
        <ImageGallery
          images={itemImages}
          initialIndex={galleryInitialIndex}
          onClose={handleGalleryClose}
        />
      )}
    </div>
  )
}
