import { useCallback } from 'react'
import { useToast } from '@/components/ui/ToastContext'

interface UseDuplicationOptions<T extends { item_id: string }> {
  items: T[]
  setItems?: (items: T[] | ((prev: T[]) => T[])) => void
  projectId?: string | undefined
  duplicationService?: (itemId: string) => Promise<string>
}

export function useDuplication<T extends { item_id: string }>({
  items,
  setItems: _setItems,
  projectId,
  duplicationService
}: UseDuplicationOptions<T>) {
  const { showSuccess, showError } = useToast()

  const duplicateItem = useCallback(async (itemId: string) => {
    try {
      const item = items.find(item => item.item_id === itemId)
      if (!item) {
        showError('Item not found')
        return
      }

      let newItemId: string

      if (duplicationService) {
        // Use custom duplication service (e.g., for business inventory)
        newItemId = await duplicationService(itemId)
      } else if (projectId) {
        // Use default project item duplication service (unified collection)
        const { unifiedItemsService } = await import('@/services/inventoryService')
        newItemId = await unifiedItemsService.duplicateItem(projectId, itemId)
      } else {
        showError('No duplication service available')
        return
      }

      // The real-time listener will handle the UI update, but we'll show a success message
      showSuccess(`Item duplicated successfully! New item ID: ${newItemId}`)

      // Note: We don't need to manually update local state here because
      // the real-time listener in the parent component will handle it
    } catch (error) {
      console.error('Failed to duplicate item:', error)
      showError('Failed to duplicate item. Please try again.')
    }
  }, [items, projectId, duplicationService, showSuccess, showError])

  return { duplicateItem }
}
