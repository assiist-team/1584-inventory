import { useState } from 'react'
import { Package, FolderOpen, Plus, QrCode } from 'lucide-react'

export default function Dashboard() {
  const [selectedProject, setSelectedProject] = useState('')
  const [projects, setProjects] = useState([
    { id: '1', name: 'Kitchen Renovation' },
    { id: '2', name: 'Bathroom Remodel' },
    { id: '3', name: 'Living Room Design' }
  ])

  const handleOpenProject = () => {
    if (selectedProject) {
      // Navigate to project
      console.log('Opening project:', selectedProject)
    }
  }

  const handleCreateProject = () => {
    const projectName = prompt('Enter project name:')
    if (projectName) {
      const newProject = {
        id: Date.now().toString(),
        name: projectName
      }
      setProjects([...projects, newProject])
      setSelectedProject(newProject.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">1584 Design Inventory & Transactions</h1>
      </div>

      {/* Project Selection */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Select Project
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <label htmlFor="projectSelect" className="block text-sm font-medium text-gray-700 mb-1">
                Choose a project
              </label>
              <select
                id="projectSelect"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">-- select a project --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleOpenProject}
                disabled={!selectedProject}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Project
              </button>
              <button
                onClick={handleCreateProject}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Inventory Management
                  </dt>
                  <dd>
                    <button className="text-sm text-primary-600 hover:text-primary-500">
                      Manage items →
                    </button>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <QrCode className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    QR Code Generator
                  </dt>
                  <dd>
                    <button className="text-sm text-primary-600 hover:text-primary-500">
                      Generate QR codes →
                    </button>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FolderOpen className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Transaction Tracking
                  </dt>
                  <dd>
                    <button className="text-sm text-primary-600 hover:text-primary-500">
                      View transactions →
                    </button>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Overview */}
      {selectedProject && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {projects.find(p => p.id === selectedProject)?.name} - Overview
            </h3>
            <div className="mt-5">
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Ready to manage inventory
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a tab above to get started with inventory or transaction management.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
