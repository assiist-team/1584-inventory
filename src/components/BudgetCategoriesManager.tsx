import { useState, useEffect, useCallback } from 'react'
import { Save, AlertCircle, Plus, Edit2, Archive, ArchiveRestore, X, Trash2 } from 'lucide-react'
import { budgetCategoriesService } from '@/services/budgetCategoriesService'
import { BudgetCategory } from '@/types'
import { useAccount } from '@/contexts/AccountContext'
import { Button } from './ui/Button'

export default function BudgetCategoriesManager() {
  const { currentAccountId, loading: accountLoading } = useAccount()
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [transactionCounts, setTransactionCounts] = useState<Map<string, number>>(new Map())
  const [isLoadingCounts, setIsLoadingCounts] = useState(false)
  const [showBulkOperations, setShowBulkOperations] = useState(false)

  const loadCategories = useCallback(async () => {
    if (!currentAccountId) return

    try {
      setIsLoading(true)
      setError(null)
      const loadedCategories = await budgetCategoriesService.getCategories(
        currentAccountId,
        showArchived
      )
      setCategories(loadedCategories)

      // Load transaction counts for active categories
      if (!showArchived && loadedCategories.length > 0) {
        setIsLoadingCounts(true)
        const activeCategoryIds = loadedCategories
          .filter(c => !c.isArchived)
          .map(c => c.id)
        
        if (activeCategoryIds.length > 0) {
          const counts = await budgetCategoriesService.getTransactionCounts(
            currentAccountId,
            activeCategoryIds
          )
          setTransactionCounts(counts)
        }
        setIsLoadingCounts(false)
      }
    } catch (err) {
      console.error('Error loading budget categories:', err)
      setError('Failed to load budget categories')
    } finally {
      setIsLoading(false)
    }
  }, [currentAccountId, showArchived])

  useEffect(() => {
    // Wait for account to finish loading
    if (accountLoading) {
      return
    }

    if (currentAccountId) {
      loadCategories()
    } else {
      // If no account ID after loading completes, stop loading
      setIsLoading(false)
      setError('No account found. Please ensure you are logged in and have an account.')
    }
  }, [currentAccountId, accountLoading, loadCategories])

  const handleStartCreate = () => {
    setCreating(true)
    setEditingId(null)
    setFormData({ name: '', slug: '' })
    setError(null)
    setSuccessMessage(null)
  }

  const handleStartEdit = (category: BudgetCategory) => {
    setEditingId(category.id)
    setCreating(false)
    setFormData({ name: category.name, slug: category.slug })
    setError(null)
    setSuccessMessage(null)
  }

  const handleCancel = () => {
    setCreating(false)
    setEditingId(null)
    setFormData({ name: '', slug: '' })
  }

  const generateSlugFromName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  const handleFormChange = (field: 'name' | 'slug', value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      // Auto-generate slug from name if slug is empty or name changed
      if (field === 'name' && (!prev.slug || prev.slug === generateSlugFromName(prev.name))) {
        updated.slug = generateSlugFromName(value)
      }
      return updated
    })
    setError(null)
    setSuccessMessage(null)
  }

  const handleSave = async () => {
    if (!currentAccountId) {
      setError('Account ID is required')
      return
    }

    if (!formData.name.trim()) {
      setError('Category name is required')
      return
    }

    if (!formData.slug.trim()) {
      setError('Category slug is required')
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      if (creating) {
        // Create new category
        await budgetCategoriesService.createCategory(
          currentAccountId,
          formData.name.trim(),
          formData.slug.trim()
        )
        setSuccessMessage('Category created successfully')
      } else if (editingId) {
        // Update existing category
        await budgetCategoriesService.updateCategory(currentAccountId, editingId, {
          name: formData.name.trim(),
          slug: formData.slug.trim()
        })
        setSuccessMessage('Category updated successfully')
      }

      // Reload categories
      await loadCategories()
      handleCancel()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error saving category:', err)
      setError(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async (categoryId: string) => {
    if (!currentAccountId) return

    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      await budgetCategoriesService.archiveCategory(currentAccountId, categoryId)
      setSuccessMessage('Category archived successfully')

      // Reload categories
      await loadCategories()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error archiving category:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive category')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnarchive = async (categoryId: string) => {
    if (!currentAccountId) return

    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      await budgetCategoriesService.unarchiveCategory(currentAccountId, categoryId)
      setSuccessMessage('Category unarchived successfully')

      // Reload categories
      await loadCategories()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error unarchiving category:', err)
      setError(err instanceof Error ? err.message : 'Failed to unarchive category')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleSelect = (categoryId: string) => {
    setSelectedCategoryIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const activeCats = categories.filter(c => !c.isArchived)
    const allActiveIds = activeCats.map(c => c.id)
    if (selectedCategoryIds.size === allActiveIds.length) {
      setSelectedCategoryIds(new Set())
    } else {
      setSelectedCategoryIds(new Set(allActiveIds))
    }
  }

  const handleBulkArchive = async () => {
    if (!currentAccountId || selectedCategoryIds.size === 0) return

    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      const categoryIdsArray = Array.from(selectedCategoryIds)
      const result = await budgetCategoriesService.bulkArchiveCategories(
        currentAccountId,
        categoryIdsArray
      )

      if (result.successful.length > 0) {
        setSuccessMessage(
          `Successfully archived ${result.successful.length} categor${result.successful.length !== 1 ? 'ies' : 'y'}.`
        )
      }

      if (result.failed.length > 0) {
        const failedMessages = result.failed.map(f => 
          `• ${categories.find(c => c.id === f.categoryId)?.name || f.categoryId}: ${f.reason}`
        ).join('\n')
        setError(`Some categories could not be archived:\n${failedMessages}`)
      }

      // Reload categories
      await loadCategories()
      setSelectedCategoryIds(new Set())

      // Clear messages after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null)
        setError(null)
      }, 5000)
    } catch (err) {
      console.error('Error bulk archiving categories:', err)
      setError(err instanceof Error ? err.message : 'Failed to archive categories')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const activeCategories = categories.filter(c => !c.isArchived)
  const archivedCategories = categories.filter(c => c.isArchived)

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-1">Budget Categories</h4>
        <p className="text-sm text-gray-500">
          Manage budget categories for transactions. Categories can be archived but not deleted if they are referenced by transactions.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="text-sm text-green-800">
            {successMessage}
          </div>
        </div>
      )}

      {/* Create Form - Only show when creating, not when editing inline */}
      {creating && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
          <h5 className="text-sm font-medium text-gray-900">
            Create New Category
          </h5>
          <div>
            <label htmlFor="category-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="category-name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="e.g., Design Fee, Furnishings"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="category-slug" className="block text-sm font-medium text-gray-700 mb-1">
              Slug *
            </label>
            <input
              type="text"
              id="category-slug"
              value={formData.slug}
              onChange={(e) => handleFormChange('slug', e.target.value)}
              placeholder="e.g., design-fee, furnishings"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              URL-friendly identifier (auto-generated from name)
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.name.trim() || !formData.slug.trim()}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : creating ? 'Create' : 'Save'}
            </Button>
            <Button
              onClick={handleCancel}
              variant="secondary"
              size="sm"
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Create Button and Bulk Operations - Hide when creating or editing */}
      {!creating && !editingId && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {activeCategories.length > 0 && (
              <>
                <Button
                  onClick={() => setShowBulkOperations(!showBulkOperations)}
                  variant="secondary"
                  size="sm"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Bulk Operations
                </Button>
                {showBulkOperations && selectedCategoryIds.size > 0 && (
                  <Button
                    onClick={handleBulkArchive}
                    variant="secondary"
                    size="sm"
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Archive Selected ({selectedCategoryIds.size})
                  </Button>
                )}
              </>
            )}
          </div>
          <Button onClick={handleStartCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      )}

      {/* Bulk Operations Panel */}
      {showBulkOperations && activeCategories.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium text-gray-900">
              Select categories to archive
            </h5>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {selectedCategoryIds.size === activeCategories.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Categories referenced by transactions cannot be archived. You must reassign those transactions first.
          </p>
        </div>
      )}

      {/* Categories Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-md">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              {showBulkOperations && (
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-12">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.size === activeCategories.length && activeCategories.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                Name
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Slug
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Transactions
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {activeCategories.length === 0 && archivedCategories.length === 0 ? (
              <tr>
                <td colSpan={showBulkOperations ? 6 : 5} className="py-8 text-center text-sm text-gray-500">
                  No categories found. Create your first category to get started.
                </td>
              </tr>
            ) : 
              activeCategories.map((category) => {
                  const transactionCount = transactionCounts.get(category.id) || 0
                  const isSelected = selectedCategoryIds.has(category.id)
                  const canArchive = transactionCount === 0
                  
                  return (
                  <tr 
                    key={category.id} 
                    className={`${editingId === category.id ? 'bg-gray-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {showBulkOperations && (
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(category.id)}
                          disabled={!canArchive}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                    )}
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {editingId === category.id ? (
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleFormChange('name', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                          autoFocus
                        />
                      ) : (
                        category.name
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {editingId === category.id ? (
                        <input
                          type="text"
                          value={formData.slug}
                          onChange={(e) => handleFormChange('slug', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      ) : (
                        <span className="font-mono text-xs">{category.slug}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {isLoadingCounts ? (
                        <span className="text-gray-400">...</span>
                      ) : transactionCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {editingId === category.id ? (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !formData.name.trim() || !formData.slug.trim()}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(category)}
                            disabled={isSaving}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(category.id)}
                            disabled={isSaving || transactionCount > 0}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={transactionCount > 0 ? `Cannot archive: referenced by ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}` : 'Archive category'}
                          >
                            <Archive className="h-3 w-3 mr-1" />
                            Archive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )})
            }
            {archivedCategories.length > 0 && (
              <>
                <tr>
                  <td colSpan={showBulkOperations ? 6 : 5} className="py-2 bg-gray-100">
                    <div className="flex items-center justify-between px-4">
                      <span className="text-sm font-medium text-gray-700">Archived Categories</span>
                      <button
                        type="button"
                        onClick={() => setShowArchived(!showArchived)}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {showArchived ? 'Hide' : 'Show'} Archived
                      </button>
                    </div>
                  </td>
                </tr>
                {showArchived &&
                  archivedCategories.map((category) => (
                    <tr key={category.id} className="bg-gray-50">
                      {showBulkOperations && <td className="py-4 pl-4 pr-3 sm:pl-6" />}
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-500 sm:pl-6">
                        {category.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className="font-mono text-xs">{category.slug}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {/* Empty cell for transactions column */}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Archived
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <button
                          type="button"
                          onClick={() => handleUnarchive(category.id)}
                          disabled={isSaving}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArchiveRestore className="h-3 w-3 mr-1" />
                          Unarchive
                        </button>
                      </td>
                    </tr>
                  ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

