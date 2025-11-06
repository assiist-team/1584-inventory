import { useCallback } from 'react'
import { BookmarkableItem } from '@/types'

interface UseBookmarkOptions<T extends BookmarkableItem> {
  items: T[]
  setItems: (items: T[] | ((prev: T[]) => T[])) => void
  updateItemService: (itemId: string, updates: Partial<T>) => Promise<void>
  projectId?: string
}

export function useBookmark<T extends BookmarkableItem>({
  items,
  setItems,
  updateItemService
}: UseBookmarkOptions<T>) {
  const toggleBookmark = useCallback(async (itemId: string) => {
    try {
      const item = items.find(item => item.itemId === itemId)
      if (!item) return

      const newBookmarkState = !item.bookmark

      // Update in database
      await updateItemService(itemId, { bookmark: newBookmarkState } as Partial<T>)

      // Update local state optimistically
      setItems(prevItems =>
        prevItems.map(item =>
          item.itemId === itemId
            ? { ...item, bookmark: newBookmarkState }
            : item
        )
      )
    } catch (error) {
      console.error('Failed to update bookmark:', error)
      // Show error notification if available
      alert('Failed to update bookmark. Please try again.')
    }
  }, [items, setItems, updateItemService])

  return { toggleBookmark }
}
