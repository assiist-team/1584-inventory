import { useState, useEffect, useCallback } from 'react'
import { Select } from './ui/Select'
import { budgetCategoriesService } from '@/services/budgetCategoriesService'
import { BudgetCategory } from '@/types'
import { useAccount } from '@/contexts/AccountContext'

interface CategorySelectProps {
  value?: string
  onChange?: (categoryId: string) => void
  label?: string
  error?: string
  helperText?: string
  disabled?: boolean
  includeArchived?: boolean
  id?: string
  className?: string
  required?: boolean
}

/**
 * CategorySelect Component
 * 
 * A reusable select component for choosing budget categories.
 * Automatically loads categories for the current account and hides archived categories by default.
 * 
 * @returns { id: string, name: string } format via onChange callback
 */
export default function CategorySelect({
  value,
  onChange,
  label = 'Budget Category',
  error,
  helperText,
  disabled = false,
  includeArchived = false,
  id,
  className,
  required = false
}: CategorySelectProps) {
  const { currentAccountId, loading: accountLoading } = useAccount()
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    if (!currentAccountId) return

    try {
      setIsLoading(true)
      setLoadError(null)
      const loadedCategories = await budgetCategoriesService.getCategories(
        currentAccountId,
        includeArchived
      )
      setCategories(loadedCategories)
    } catch (err) {
      console.error('Error loading budget categories:', err)
      setLoadError('Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }, [currentAccountId, includeArchived])

  useEffect(() => {
    // Wait for account to finish loading
    if (accountLoading) {
      return
    }

    if (currentAccountId) {
      loadCategories()
    } else {
      setIsLoading(false)
    }
  }, [currentAccountId, accountLoading, loadCategories])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = e.target.value
    if (onChange) {
      onChange(categoryId)
    }
  }

  // Show error from loading or from props
  const displayError = error || loadError

  return (
    <Select
      id={id}
      label={label}
      value={value || ''}
      onChange={handleChange}
      error={displayError}
      helperText={helperText}
      disabled={disabled || isLoading}
      className={className}
    >
      {required ? null : <option value="">Select a category</option>}
      {isLoading ? (
        <option disabled>Loading categories...</option>
      ) : categories.length === 0 ? (
        <option disabled>No categories available</option>
      ) : (
        categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))
      )}
    </Select>
  )
}

/**
 * Hook to get categories as { id, name } array
 * Useful when you need the category list but not a select component
 */
export function useCategories(includeArchived: boolean = false): {
  categories: Array<{ id: string; name: string }>
  isLoading: boolean
  error: string | null
} {
  const { currentAccountId, loading: accountLoading } = useAccount()
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (accountLoading || !currentAccountId) {
      if (!accountLoading && !currentAccountId) {
        setIsLoading(false)
        setError('No account found')
      }
      return
    }

    const loadCategories = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const loadedCategories = await budgetCategoriesService.getCategories(
          currentAccountId,
          includeArchived
        )
        setCategories(
          loadedCategories.map(cat => ({
            id: cat.id,
            name: cat.name
          }))
        )
      } catch (err) {
        console.error('Error loading budget categories:', err)
        setError('Failed to load categories')
      } finally {
        setIsLoading(false)
      }
    }

    loadCategories()
  }, [currentAccountId, accountLoading, includeArchived])

  return { categories, isLoading, error }
}

