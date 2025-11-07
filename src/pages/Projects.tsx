import { useState, useEffect } from 'react'
import { Plus, FolderOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Project, Transaction } from '@/types'
import { projectService, transactionService } from '@/services/inventoryService'
import { useAuth } from '@/contexts/AuthContext'
import { useAccount } from '@/contexts/AccountContext'
import ProjectForm from '@/components/ProjectForm'
import BudgetProgress from '@/components/ui/BudgetProgress'

export default function Projects() {
  const { user } = useAuth()
  const { currentAccountId, loading: accountLoading } = useAccount()
  const [projects, setProjects] = useState<Project[]>([])
  const [transactions, setTransactions] = useState<Record<string, Transaction[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (accountLoading) {
      setIsLoading(true)
      return
    }
    if (currentAccountId) {
      loadProjectsData()
    } else {
      setIsLoading(false)
    }
  }, [currentAccountId, accountLoading])

  const handleCreateProject = async (projectData: any) => {
    if (!user?.email) {
      throw new Error('User must be authenticated to create projects')
    }
    if (!currentAccountId) {
      throw new Error('Account ID is required to create projects')
    }

    try {
      await projectService.createProject(currentAccountId, {
        ...projectData,
        createdBy: user.id
      })

      // Reload projects and transactions
      await loadProjectsData()
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating project:', error)
      throw error // Let the form handle the error
    }
  }

  const loadProjectsData = async () => {
    if (!currentAccountId) return
    
    setIsLoading(true)
    try {
      const projectsData = await projectService.getProjects(currentAccountId)
      setProjects(projectsData)

      if (projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id)
        const allTransactions = await transactionService.getTransactionsForProjects(currentAccountId, projectIds)

        const transactionsByProject: Record<string, Transaction[]> = {}
        for (const transaction of allTransactions) {
          if (!transactionsByProject[transaction.projectId]) {
            transactionsByProject[transaction.projectId] = []
          }
          transactionsByProject[transaction.projectId].push(transaction)
        }
        setTransactions(transactionsByProject)
      } else {
        setTransactions({})
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      setProjects([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleShowCreateForm = () => {
    setShowCreateForm(true)
  }

  const handleCloseCreateForm = () => {
    setShowCreateForm(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleShowCreateForm}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading projects...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center py-12">
              <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No projects yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first project to start organizing your inventory.
              </p>
              <div className="mt-6">
                <button
                  onClick={handleShowCreateForm}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="bg-white shadow rounded-lg border border-gray-200">
              <div className="p-6">
                {/* Project Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FolderOpen className="h-8 w-8 text-primary-600 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {project.name}
                    </h3>
                  </div>
                </div>

                {/* Project Client */}
                <div className="mb-4">
                  <div className="text-sm font-normal text-gray-900 ml-11">
                    {project.clientName}
                  </div>
                </div>

                {/* Budget Progress */}
                <div className="mb-4">
                  <BudgetProgress
                    budget={project.budget}
                    designFee={project.designFee}
                    budgetCategories={project.budgetCategories}
                    transactions={transactions[project.id] || []}
                    previewMode={true}
                  />
                </div>




                {/* Action Button */}
                <div className="flex justify-center">
                  <Link
                    to={`/project/${project.id}`}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open Project
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Creation Form */}
      {showCreateForm && (
        <ProjectForm
          onSubmit={handleCreateProject}
          onCancel={handleCloseCreateForm}
        />
      )}

    </div>
  )
}
