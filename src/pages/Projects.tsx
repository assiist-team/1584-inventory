import { useState, useEffect } from 'react'
import { Plus, FolderOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Project, Transaction } from '@/types'
import { projectService, transactionService } from '@/services/inventoryService'
import { formatDate } from '@/utils/dateUtils'
import { useAuth } from '@/contexts/AuthContext'
import ProjectForm from '@/components/ProjectForm'
import { CompactBudgetProgress } from '@/components/ui/BudgetProgress'

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [transactions, setTransactions] = useState<Record<string, Transaction[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    loadProjectsData()
  }, [])

  const handleCreateProject = async (projectData: any) => {
    if (!user?.email) {
      throw new Error('User must be authenticated to create projects')
    }

    try {
      await projectService.createProject({
        ...projectData,
        createdBy: user.email
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
    setIsLoading(true)
    try {
      const projectsData = await projectService.getProjects()
      setProjects(projectsData)

      // Load transactions for each project
      const transactionsData: Record<string, Transaction[]> = {}
      for (const project of projectsData) {
        try {
          const projectTransactions = await transactionService.getTransactions(project.id)
          transactionsData[project.id] = projectTransactions
        } catch (error) {
          console.error(`Error loading transactions for project ${project.id}:`, error)
          transactionsData[project.id] = []
        }
      }
      setTransactions(transactionsData)
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <FolderOpen className="h-8 w-8 text-primary-600 mr-3" />
                    <h3 className="text-lg font-medium text-gray-900">
                      {project.name}
                    </h3>
                  </div>
                </div>

                {/* Budget Progress */}
                <div className="mb-4">
                  <CompactBudgetProgress
                    budget={project.budget}
                    designFee={project.designFee}
                    transactions={transactions[project.id] || []}
                  />
                </div>

                {/* Project Client */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-500">Client</span>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {project.clientName}
                  </div>
                </div>

                {/* Project Budget & Design Fee */}
                {(project.budget || project.designFee) && (
                  <div className="mb-4 space-y-2">
                    {project.budget && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Budget</span>
                        <div className="flex items-center text-lg font-semibold text-gray-900">
                          {project.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </div>
                      </div>
                    )}
                    {project.designFee && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Design Fee</span>
                        <div className="flex items-center text-lg font-semibold text-gray-900">
                          {project.designFee.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Project Date */}
                <div className="text-xs text-gray-400 mb-4">
                  Created: {formatDate(project.createdAt)}
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
