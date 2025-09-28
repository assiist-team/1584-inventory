import { ArrowLeft, Package, FileText, Edit, Trash2 } from 'lucide-react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Project, Transaction } from '@/types'
import { projectService, transactionService } from '@/services/inventoryService'
import InventoryList from './InventoryList'
import TransactionsList from './TransactionsList'
import ProjectForm from '@/components/ProjectForm'
import BudgetProgress from '@/components/ui/BudgetProgress'
import { useToast } from '@/components/ui/ToastContext'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError } = useToast()

  // Get active tab from URL parameters, default to 'inventory'
  const activeTab = searchParams.get('tab') || 'inventory'

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('tab', tabId)
    setSearchParams(newSearchParams)
  }

  useEffect(() => {
    const loadProjectAndTransactions = async () => {
      if (!id) {
        navigate('/projects')
        return
      }

      try {
        // Load project data
        const projectData = await projectService.getProject(id)
        if (projectData) {
          setProject(projectData)

          // Load transactions for budget calculation
          const transactionsData = await transactionService.getTransactions(id)
          setTransactions(transactionsData)
        } else {
          // Project not found
          navigate('/projects')
        }
      } catch (error) {
        console.error('Error loading project:', error)
        navigate('/projects')
      } finally {
        setIsLoading(false)
      }
    }

    loadProjectAndTransactions()
  }, [id, navigate])

  // Subscribe to real-time transaction updates
  useEffect(() => {
    if (!id) return

    const unsubscribe = transactionService.subscribeToTransactions(id, (updatedTransactions) => {
      setTransactions(updatedTransactions)
    })

    return unsubscribe
  }, [id])

  const handleEditProject = async (projectData: any) => {
    if (!project || !id) return

    try {
      await projectService.updateProject(id, projectData)
      // Reload project data
      const updatedProject = await projectService.getProject(id)
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
    if (!id) return

    setIsDeleting(true)
    try {
      await projectService.deleteProject(id)
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
    { id: 'inventory', name: 'Inventory', icon: Package },
    { id: 'transactions', name: 'Transactions', icon: FileText }
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

  if (!project) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-gray-400">📁</div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Project not found</h3>
        <p className="mt-1 text-sm text-gray-500">The project you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/projects"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
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
            to="/projects"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
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

        {/* Project information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{project.name}</h1>
          {(project.budget || project.designFee) && (
            <div className="flex flex-wrap items-center gap-4">
              {project.budget && (
                <div className="flex items-center text-sm text-gray-600">
                  <span>Budget: {project.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                </div>
              )}
              {project.designFee && (
                <div className="flex items-center text-sm text-gray-600">
                  <span>Design Fee: {project.designFee.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Budget Progress */}
      {project && (
        <BudgetProgress
          budget={project.budget}
          designFee={project.designFee}
          transactions={transactions}
        />
      )}

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
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
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
            <InventoryList projectId={project.id} projectName={project.name} />
          )}
          {activeTab === 'transactions' && (
            <TransactionsList projectId={project.id} />
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
