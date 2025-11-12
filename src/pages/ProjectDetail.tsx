import { ArrowLeft, Package, FileText, Edit, Trash2, DollarSign, Building2, User, Receipt } from 'lucide-react'
import { useMemo } from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import ContextBackLink from '@/components/ContextBackLink'
import { useStackedNavigate } from '@/hooks/useStackedNavigate'
import { useState, useEffect } from 'react'
import { Project, Transaction, Item } from '@/types'
import { projectService, transactionService, unifiedItemsService } from '@/services/inventoryService'
import { lineageService } from '@/services/lineageService'
import { useAccount } from '@/contexts/AccountContext'
import InventoryList from './InventoryList'
import TransactionsList from './TransactionsList'
import ProjectForm from '@/components/ProjectForm'
import BudgetProgress from '@/components/ui/BudgetProgress'
import { useToast } from '@/components/ui/ToastContext'
import { Button } from '@/components/ui/Button'
import { CLIENT_OWES_COMPANY, COMPANY_OWES_CLIENT } from '@/constants/company'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useStackedNavigate()
  const location = useLocation()
  const { currentAccountId } = useAccount()
  const [searchParams, setSearchParams] = useSearchParams()
  const budgetTabParam = searchParams.get('budgetTab')
  const [project, setProject] = useState<Project | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError } = useToast()

  // Get active tab from URL parameters, default to 'transactions'
  const activeTab = searchParams.get('tab') || 'transactions'

  // Budget tabs state, default to 'budget'
  const [activeBudgetTab, setActiveBudgetTab] = useState<string>(() => (budgetTabParam === 'accounting' ? 'accounting' : 'budget'))

  // Navigation context logic
  const currentSearchParams = new URLSearchParams(location.search)
  const fromBusinessInventoryItem = currentSearchParams.get('from') === 'business-inventory-item'

  const backDestination = useMemo(() => {
    // Check if we have a returnTo parameter (highest priority)
    const returnTo = currentSearchParams.get('returnTo')
    if (returnTo) return returnTo

    // If we came from business inventory item, go back there
    if (fromBusinessInventoryItem) {
      // Extract the item ID from the returnTo URL if available, otherwise go to main inventory
      const returnToUrl = currentSearchParams.get('returnTo')
      if (returnToUrl && returnToUrl.includes('/business-inventory/')) {
        return returnToUrl
      }
      return '/business-inventory' // Fallback to main inventory
    }

    return '/projects' // Default to projects list
  }, [fromBusinessInventoryItem, currentSearchParams])

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('tab', tabId)
    setSearchParams(newSearchParams)
  }

  // Handle budget tab changes
  const handleBudgetTabChange = (tabId: string) => {
    setActiveBudgetTab(tabId)
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('budgetTab', tabId)
    setSearchParams(newSearchParams)
  }

  // Calculate amounts owed - simple sum of transaction amounts by reimbursement type
  const owedTo1584 = useMemo(() => {
    return transactions
      .filter(t => t.status !== 'canceled')
      .filter(t => t.reimbursementType === CLIENT_OWES_COMPANY)
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
  }, [transactions])

  const owedToClient = useMemo(() => {
    return transactions
      .filter(t => t.status !== 'canceled')
      .filter(t => t.reimbursementType === COMPANY_OWES_CLIENT)
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)
  }, [transactions])

  useEffect(() => {
    console.log('🔍 ProjectDetail - useEffect triggered. id:', id, 'currentAccountId:', currentAccountId, 'isLoading:', isLoading)
    
    let transactionUnsubscribe: (() => void) | undefined
    let itemsUnsubscribe: (() => void) | undefined

    const setupTransactionSubscription = (initialTransactions: Transaction[]) => {
      if (!id || !currentAccountId) return
      transactionUnsubscribe = transactionService.subscribeToTransactions(
        currentAccountId,
        id,
        (updatedTransactions) => {
          setTransactions(updatedTransactions)
        },
        initialTransactions
      )
    }

    const setupItemsSubscription = (initialItems: Item[]) => {
      if (!id || !currentAccountId) return
      itemsUnsubscribe = unifiedItemsService.subscribeToProjectItems(
        currentAccountId,
        id,
        (updatedItems) => {
          setItems(updatedItems)
        },
        initialItems
      )
    }

    const loadData = async () => {
      console.log('🔍 ProjectDetail - loadData called. id:', id, 'currentAccountId:', currentAccountId)
      
      if (!id) {
        console.warn('No project ID provided, redirecting to projects')
        navigate('/projects')
        return
      }
      if (!currentAccountId) {
        console.log('🔍 ProjectDetail - No account ID yet, waiting...')
        return
      }

      setIsLoading(true)
      try {
        console.log('🔍 ProjectDetail - Loading project data for ID:', id)
        const projectData = await projectService.getProject(currentAccountId, id)
        if (projectData) {
          console.log('🔍 ProjectDetail - Project loaded successfully:', projectData.name)
          setProject(projectData)

          const [transactionsData, itemsData] = await Promise.all([
            transactionService.getTransactions(currentAccountId, id),
            unifiedItemsService.getItemsByProject(currentAccountId, id)
          ])

          console.log('🔍 ProjectDetail - Loaded', transactionsData.length, 'transactions and', itemsData.length, 'items')
          setTransactions(transactionsData)
          setItems(itemsData)
          setupTransactionSubscription(transactionsData)
          setupItemsSubscription(itemsData)
        } else {
          console.warn('Project not found:', id)
          navigate('/projects')
        }
      } catch (error) {
        console.error('Error loading project:', error)
        setError('Failed to load project. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    return () => {
      if (transactionUnsubscribe) transactionUnsubscribe()
      if (itemsUnsubscribe) itemsUnsubscribe()
    }
  }, [id, currentAccountId, navigate])

  // Subscribe to edges-from-transaction for each transaction so we can refresh items
  useEffect(() => {
    if (!currentAccountId || !id || transactions.length === 0) return

    const unsubs: (() => void)[] = []
    try {
      transactions.forEach(tx => {
        if (!tx.transactionId) return
        const unsub = lineageService.subscribeToEdgesFromTransaction(currentAccountId, tx.transactionId, async () => {
          try {
            const updatedItems = await unifiedItemsService.getItemsByProject(currentAccountId, id)
            setItems(updatedItems)
          } catch (err) {
            console.debug('ProjectDetail - failed to refresh items on lineage event', err)
          }

          // Also refresh transactions for the project to reflect any deletions/changes
          try {
            const updatedTransactions = await transactionService.getTransactions(currentAccountId, id)
            setTransactions(updatedTransactions)
          } catch (tErr) {
            console.debug('ProjectDetail - failed to refresh transactions on lineage event', tErr)
          }
        })
        unsubs.push(unsub)
      })
    } catch (err) {
      console.debug('ProjectDetail - failed to subscribe to edges from transactions', err)
    }

    return () => {
      unsubs.forEach(u => {
        try { u() } catch (e) { /* noop */ }
      })
    }
  }, [transactions.map(t => t.transactionId).join(','), currentAccountId, id])

  // Retry function for failed loads
  const retryLoadProject = () => {
    setError(null)
    // We need to reload the data, not just call the old function
    if (id && currentAccountId) {
      // Re-trigger the useEffect
      navigate(0); 
    }
  };

  const handleEditProject = async (projectData: any) => {
    if (!project || !id || !currentAccountId) return

    try {
      await projectService.updateProject(currentAccountId, id, projectData)
      // Reload project data
      const updatedProject = await projectService.getProject(currentAccountId, id)
      setProject(updatedProject)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating project:', error)
      throw error // Let the form handle the error
    }
  }

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleShowDeleteConfirm = () => {
    setShowDeleteConfirm(true)
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  const handleDeleteProject = async () => {
    if (!id || !currentAccountId) return

    setIsDeleting(true)
    try {
      await projectService.deleteProject(currentAccountId, id)
      // Redirect to projects list after successful deletion
      navigate('/projects')
    } catch (error) {
      console.error('Error deleting project:', error)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      // Show error message to user
      showError('Failed to delete project. Please try again.')
    }
  }

  const tabs = [
    { id: 'inventory', name: 'Items', icon: Package },
    { id: 'transactions', name: 'Transactions', icon: FileText }
  ]

  const budgetTabs = [
    { id: 'budget', name: 'Budget', icon: FileText },
    { id: 'accounting', name: 'Accounting', icon: DollarSign }
  ]

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-red-400">⚠️</div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Project</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <div className="mt-6 flex justify-center space-x-3">
          <button
            onClick={retryLoadProject}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Try Again
          </button>
          <ContextBackLink
            fallback={backDestination}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </ContextBackLink>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400">📁</div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Project not found</h3>
        <p className="mt-1 text-sm text-gray-500">The project you're looking for doesn't exist.</p>
        <div className="mt-6">
          <ContextBackLink
            fallback={backDestination}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </ContextBackLink>
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
          <ContextBackLink
            fallback={backDestination}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </ContextBackLink>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
            <button
              onClick={handleShowDeleteConfirm}
              className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>

        {/* Project information and Budget/Accounting Tabs */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* Project information */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{project.name}</h1>
            {project.clientName && (
              <p className="text-lg text-gray-600 mb-6">{project.clientName}</p>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {budgetTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleBudgetTabChange(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-base flex items-center ${
                      activeBudgetTab === tab.id
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
          <div className="pt-6">
            {activeBudgetTab === 'budget' && project && (
              <BudgetProgress
                budget={project.budget}
                designFee={project.designFee}
                budgetCategories={project.budgetCategories}
                transactions={transactions}
              />
            )}
            {activeBudgetTab === 'accounting' && (
              <div className="space-y-6">
                {/* Dashboard Section */}
                <section>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Owed to Design Business */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-600 mb-0.5">Owed to Design Business</div>
                      <div className="text-xl font-bold text-gray-900">
                        ${owedTo1584.toFixed(2)}
                      </div>
                    </div>

                    {/* Owed to Client */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-600 mb-0.5">Owed to Client</div>
                      <div className="text-xl font-bold text-gray-900">
                        ${owedToClient.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Reports Section */}
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Reports</h2>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => navigate(`/project/${project.id}/property-management-summary`)}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Generate Property Management Summary
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/project/${project.id}/client-summary`)}>
                      <User className="h-4 w-4 mr-2" />
                      Generate Client Summary
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/project/${project.id}/invoice`)}>
                      <Receipt className="h-4 w-4 mr-2" />
                      Generate Invoice
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
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
                  onClick={() => handleTabChange(tab.id)}
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
          {activeTab === 'inventory' && project && (
            <>
              {console.log('🔍 ProjectDetail - Rendering InventoryList with', items.length, 'items')}
              <InventoryList projectId={project.id} projectName={project.name} items={items} />
            </>
          )}
          {activeTab === 'transactions' && project && (
            <TransactionsList projectId={project.id} transactions={transactions} />
          )}
        </div>
      </div>

        {/* Project Edit Form */}
        {isEditing && project && (
          <ProjectForm
            initialData={{
              name: project.name,
              description: project.description,
              clientName: project.clientName,
              budget: project.budget,
              designFee: project.designFee,
              budgetCategories: project.budgetCategories,
              defaultCategoryId: project.defaultCategoryId,
            }}
            onSubmit={handleEditProject}
            onCancel={handleCancelEdit}
          />
        )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete
                </h3>
                <button
                  onClick={handleCancelDelete}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="mt-2">
                <p className="text-sm text-gray-500 mb-4">
                  Are you sure you want to delete the project <strong>"{project?.name}"</strong>?
                  This action cannot be undone and will permanently delete the project and all associated data.
                </p>

                {/* Warning about items and transactions */}
                {project && project.metadata?.totalItems && project.metadata.totalItems > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                    <div className="flex">
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-yellow-800">
                          Warning
                        </h4>
                        <div className="mt-1 text-sm text-yellow-700">
                          <p>This project contains {project.metadata.totalItems} item(s). Deleting the project will permanently remove all associated data.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCancelDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
