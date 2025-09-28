import { useState } from 'react'
import { Edit, X } from 'lucide-react'
import { TransactionItemFormData } from '@/types'
import TransactionItemForm from './TransactionItemForm'

interface TransactionItemsListProps {
  items: TransactionItemFormData[]
  onItemsChange: (items: TransactionItemFormData[]) => void
  projectId?: string
  projectName?: string
  onImageFilesChange?: (itemId: string, imageFiles: File[]) => void
}

export default function TransactionItemsList({ items, onItemsChange, projectId, projectName, onImageFilesChange }: TransactionItemsListProps) {
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const handleSaveItem = (item: TransactionItemFormData) => {
    if (editingItemId) {
      // Update existing item
      const updatedItems = items.map(existingItem =>
        existingItem.id === editingItemId ? item : existingItem
      )
      onItemsChange(updatedItems)
    } else {
      // Add new item
      onItemsChange([...items, item])
    }

    // Handle image files if they exist
    if (item.imageFiles && item.imageFiles.length > 0 && onImageFilesChange) {
      onImageFilesChange(item.id, item.imageFiles)
    }

    setIsAddingItem(false)
    setEditingItemId(null)
  }

  const handleCancelItem = () => {
    setIsAddingItem(false)
    setEditingItemId(null)
  }

  const handleEditItem = (itemId: string) => {
    setEditingItemId(itemId)
    setIsAddingItem(false)
  }

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId)
    onItemsChange(updatedItems)
  }

  const getItemToEdit = () => {
    if (!editingItemId) return null
    return items.find(item => item.id === editingItemId) || null
  }

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount)
    return isNaN(num) ? '$0.00' : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (isAddingItem || editingItemId) {
    const itemToEdit = getItemToEdit()
    return (
      <TransactionItemForm
        item={itemToEdit || undefined}
        onSave={handleSaveItem}
        onCancel={handleCancelItem}
        isEditing={!!itemToEdit}
        projectId={projectId}
        projectName={projectName}
        onImageFilesChange={onImageFilesChange}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Transaction Items</h3>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">No items added to this transaction yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      Item {index + 1}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    {item.description || 'No description'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    {item.sku && (
                      <div>
                        <span className="font-medium">SKU:</span> {item.sku}
                      </div>
                    )}
                    {item.market_value && (
                      <div>
                        <span className="font-medium">Market Value:</span> ${item.market_value}
                      </div>
                    )}
                  </div>

                  {item.notes && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Notes:</span> {item.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleEditItem(item.id)
                    }}
                    className="text-primary-600 hover:text-primary-900 p-1"
                    title="Edit item"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDeleteItem(item.id)
                    }}
                    className="text-red-600 hover:text-red-900 p-1"
                    title="Delete item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total Items: {items.length}
            </div>
            <div className="text-lg font-semibold text-gray-900">
              Total: {formatCurrency(
                items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toString()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
