import { ArrowLeft, Edit, Trash2, Calendar, CreditCard, FileText, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
import ImageGallery from '@/components/ui/ImageGallery'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Transaction, Project } from '@/types'
import { transactionService, projectService } from '@/services/inventoryService'
import { formatDate, formatCurrency } from '@/utils/dateUtils'
import { useToast } from '@/components/ui/ToastContext'

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


export default function TransactionDetail() {
  const { id: projectId, transactionId } = useParams<{ id: string; transactionId: string }>()
  const navigate = useNavigate()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const { showError } = useToast()


  useEffect(() => {
    const loadTransaction = async () => {
      if (!projectId || !transactionId) return

      try {
        // Fetch both transaction and project data
        const [transactionData, projectData] = await Promise.all([
          transactionService.getTransaction(projectId, transactionId),
          projectService.getProject(projectId)
        ])

        const convertedTransaction: Transaction = {
          ...transactionData,
          transaction_images: Array.isArray(transactionData?.transaction_images) ? transactionData.transaction_images : []
        } as Transaction

        console.log('TransactionDetail - loaded transactionData:', transactionData)
        console.log('TransactionDetail - convertedTransaction:', convertedTransaction)
        setTransaction(convertedTransaction)
        setProject(projectData)


      } catch (error) {
        console.error('Error loading transaction:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTransaction()
  }, [projectId, transactionId])

  // Set up real-time subscription for transaction updates
  useEffect(() => {
    if (!projectId || !transactionId) return

    // Temporarily disable real-time subscription to debug
    // const unsubscribe = transactionService.subscribeToTransaction(
    //   projectId,
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
  }, [projectId, transactionId])


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
    if (!projectId || !transactionId || !transaction) return

    if (window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      try {
        await transactionService.deleteTransaction(projectId, transactionId)
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

  // Convert transaction images to ItemImage format for the gallery
  const itemImages = transaction?.transaction_images?.map((img, index) => ({
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
            to={`/project/${projectId}?tab=transactions`}
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
            to={`/project/${projectId}?tab=transactions`}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
          <div className="flex space-x-3">
            <Link
              to={`/project/${projectId}/transaction/${transactionId}/edit`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {transaction.source}
          </h1>
        </div>

        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Transaction Date
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {transaction.transaction_date ? formatDate(transaction.transaction_date) : 'No date'}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Transaction Type</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium no-icon ${
                  transaction.transaction_type === 'Purchase'
                    ? 'bg-green-100 text-green-800'
                    : transaction.transaction_type === 'Return'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {transaction.transaction_type}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <CreditCard className="h-4 w-4 mr-1" />
                Payment Method
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{transaction.payment_method}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">
                Amount
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-medium">{formatCurrency(transaction.amount)}</dd>
            </div>

            {transaction.receipt_emailed && (
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
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  Notes
                </dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{transaction.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Transaction Images */}
        {transaction.transaction_images && transaction.transaction_images.length > 0 && (
          <div className="px-6 py-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <ImageIcon className="h-5 w-5 mr-2" />
              Transaction Images
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6" style={{width: 'fit-content'}}>
              {transaction.transaction_images.map((image, index) => (
                <div
                  key={index}
                  className="w-24 h-24 sm:w-20 sm:h-20 relative group cursor-pointer rounded-lg overflow-hidden border-2 border-gray-200 hover:border-primary-300 transition-colors"
                  onClick={() => handleImageClick(index)}
                >
                  <img
                    src={image.url}
                    alt={image.fileName}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />

                  {/* Image index */}
                  {transaction.transaction_images && transaction.transaction_images.length > 1 && (
                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                      {index + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Image count */}
            <p className="text-xs text-gray-500 mt-2">
              {transaction.transaction_images.length} image{transaction.transaction_images.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}


        {/* Metadata */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project</dt>
              <dd className="mt-1 text-sm text-gray-900">{project?.name || transaction.project_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(transaction.created_at)}
              </dd>
            </div>
          </dl>
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
