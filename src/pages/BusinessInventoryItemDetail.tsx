import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Edit, Trash2, ArrowLeft, Package, TrendingUp, Plus } from 'lucide-react'
import { BusinessInventoryItem, Project } from '@/types'
import { businessInventoryService, projectService } from '@/services/inventoryService'
import { formatCurrency, formatDate } from '@/utils/dateUtils'

export default function BusinessInventoryItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<BusinessInventoryItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [allocationForm, setAllocationForm] = useState({
    projectId: '',
    amount: '',
    notes: ''
  })

  useEffect(() => {
    if (id) {
      loadItem()
      loadProjects()
    }
  }, [id])

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


  const handleReturnFromProject = async () => {
    if (!id || !item?.pending_transaction_id) return

    setIsUpdating(true)
    try {
      await businessInventoryService.returnItemFromProject(
        id,
        item.pending_transaction_id,
        item.current_project_id!
      )
      // Item will be updated via real-time subscription
    } catch (error) {
      console.error('Error returning item:', error)
      alert('Error returning item. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMarkAsSold = async (paymentMethod: string) => {
    if (!id || !item?.pending_transaction_id) return

    setIsUpdating(true)
    try {
      await businessInventoryService.markItemAsSold(
        id,
        item.pending_transaction_id,
        item.current_project_id!,
        paymentMethod
      )
      // Item will be updated via real-time subscription
    } catch (error) {
      console.error('Error marking item as sold:', error)
      alert('Error marking item as sold. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const openAllocationModal = () => {
    setShowAllocationModal(true)
  }

  const closeAllocationModal = () => {
    setShowAllocationModal(false)
    setAllocationForm({
      projectId: '',
      amount: '',
      notes: ''
    })
  }

  const handleAllocationSubmit = async () => {
    if (!id || !allocationForm.projectId || !allocationForm.amount) return

    setIsUpdating(true)
    try {
      await businessInventoryService.allocateItemToProject(
        id,
        allocationForm.projectId,
        allocationForm.amount,
        allocationForm.notes
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
          to="/business-inventory"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link
                to="/business-inventory"
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{item.description}</h1>
                <p className="text-sm text-gray-600">SKU: {item.sku}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/business-inventory/${id}/edit`}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Item Details */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Item Details</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Price</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatCurrency(item.price)}</dd>
                </div>
                {item.market_value && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Market Value</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatCurrency(item.market_value)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Source</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{item.source}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{item.payment_method}</dd>
                </div>
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
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date Added</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(item.date_created)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(item.last_updated)}</dd>
                </div>
              </dl>

              {item.notes && (
                <div className="mt-6">
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900">{item.notes}</dd>
                </div>
              )}
            </div>
          </div>

          {/* Project Assignment */}
          {item.current_project_id && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Project Assignment</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Currently allocated to project: <span className="font-medium">{item.current_project_id}</span>
                    </p>
                    {item.pending_transaction_id && (
                      <p className="text-sm text-gray-500 mt-1">
                        Pending transaction: {item.pending_transaction_id}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {item.inventory_status === 'pending' && (
                      <>
                        <button
                          onClick={handleReturnFromProject}
                          disabled={isUpdating}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          Return to Inventory
                        </button>
                        <button
                          onClick={() => handleMarkAsSold('Client Card')}
                          disabled={isUpdating}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Mark as Sold
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Images */}
          {item.images && item.images.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Images</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {item.images.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={image.url}
                        alt={image.alt || `Image ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      {image.caption && (
                        <p className="mt-2 text-sm text-gray-600">{image.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {item.inventory_status === 'available' && (
                  <>
                    <button
                      onClick={openAllocationModal}
                      disabled={isUpdating}
                      className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Allocate to Project
                    </button>
                  </>
                )}
                <Link
                  to={`/business-inventory/${id}/edit`}
                  className="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Item
                </Link>
              </div>
            </div>
          </div>

          {/* Status History */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Status History</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Current Status:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Date Created:</span>
                  <span className="text-gray-900">{formatDate(item.date_created)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Last Updated:</span>
                  <span className="text-gray-900">{formatDate(item.last_updated)}</span>
                </div>
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
                  <label htmlFor="project-select" className="block text-sm font-medium text-gray-700">
                    Select Project
                  </label>
                  <select
                    id="project-select"
                    value={allocationForm.projectId}
                    onChange={(e) => setAllocationForm(prev => ({ ...prev, projectId: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} - {project.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="allocation-amount" className="block text-sm font-medium text-gray-700">
                    Amount to Bill Client
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="allocation-amount"
                    value={allocationForm.amount}
                    onChange={(e) => setAllocationForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="allocation-notes" className="block text-sm font-medium text-gray-700">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="allocation-notes"
                    rows={3}
                    value={allocationForm.notes}
                    onChange={(e) => setAllocationForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Additional notes about this allocation..."
                  />
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
                  disabled={!allocationForm.projectId || !allocationForm.amount || isUpdating}
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
