import { useEffect, useMemo, useState } from 'react'
import { Edit, X, Plus, GitMerge } from 'lucide-react'
import { TransactionItemFormData } from '@/types'
import TransactionItemForm from './TransactionItemForm'
import { normalizeMoneyToTwoDecimalString } from '@/utils/money'

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
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [mergeMasterId, setMergeMasterId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedItemIds(prev => {
      const valid = new Set<string>()
      for (const item of items) {
        if (prev.has(item.id)) valid.add(item.id)
      }
      return valid.size === prev.size ? prev : valid
    })
  }, [items])

  const selectedItems = useMemo(
    () => items.filter(item => selectedItemIds.has(item.id)),
    [items, selectedItemIds]
  )

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
    setSelectedItemIds(prev => {
      if (!prev.has(itemId)) return prev
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  const getItemToEdit = () => {
    if (!editingItemId) return null
    return items.find(item => item.id === editingItemId) || null
  }

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount)
    return isNaN(num) ? '$0.00' : `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const hasNonEmptyMoneyString = (value: string | undefined) => {
    if (value === undefined) return false
    if (typeof value !== 'string') return false
    if (!value.trim()) return false
    const n = Number.parseFloat(value)
    return Number.isFinite(n)
  }

  const toggleItemSelection = (itemId: string, checked: boolean) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set())
      return
    }
    setSelectedItemIds(new Set(items.map(item => item.id)))
  }

  const closeMergeDialog = () => {
    setIsMergeDialogOpen(false)
    setMergeMasterId(null)
  }

  const openMergeDialog = () => {
    const defaults = selectedItems
    if (defaults.length < 2) return
    setMergeMasterId(defaults[0]?.id ?? null)
    setIsMergeDialogOpen(true)
  }

  const parseMoney = (value?: string): number => {
    if (!value || !value.trim()) return 0
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const formatMoney = (value: number): string => {
    const normalized = normalizeMoneyToTwoDecimalString(value.toFixed(2))
    return normalized ?? value.toFixed(2)
  }

  const aggregateMoneyField = (
    field: keyof Pick<
      TransactionItemFormData,
      'purchasePrice' | 'projectPrice' | 'price' | 'taxAmountPurchasePrice' | 'taxAmountProjectPrice'
    >,
    master: TransactionItemFormData,
    absorbed: TransactionItemFormData[]
  ): string | undefined => {
    const values = [master[field], ...absorbed.map(item => item[field])]
    const hasValue = values.some(val => hasNonEmptyMoneyString(val))
    if (!hasValue) return master[field]
    const total = values.reduce((sum, val) => sum + parseMoney(val), 0)
    return formatMoney(total)
  }

  const buildMergedNotes = (master: TransactionItemFormData, absorbed: TransactionItemFormData[]): string | undefined => {
    if (absorbed.length === 0) return master.notes
    const masterNotes = master.notes?.trim() ?? ''
    const absorbedLines = absorbed.map(item => {
      const description = item.description?.trim() || 'Unnamed item'
      const sku = item.sku?.trim() ? ` (SKU ${item.sku.trim()})` : ''
      return `- ${description}${sku}`
    })
    const mergedSection = ['Merged items:', ...absorbedLines].join('\n')
    if (!masterNotes) return mergedSection
    return `${masterNotes}\n\n${mergedSection}`
  }

  const handleConfirmMerge = () => {
    if (!mergeMasterId) return
    const masterItem = items.find(item => item.id === mergeMasterId)
    if (!masterItem) return
    const absorbedItems = selectedItems.filter(item => item.id !== mergeMasterId)
    if (absorbedItems.length === 0) {
      closeMergeDialog()
      return
    }

    const updatedMaster: TransactionItemFormData = {
      ...masterItem,
      purchasePrice: aggregateMoneyField('purchasePrice', masterItem, absorbedItems),
      price: aggregateMoneyField('price', masterItem, absorbedItems) ?? aggregateMoneyField('purchasePrice', masterItem, absorbedItems),
      projectPrice: aggregateMoneyField('projectPrice', masterItem, absorbedItems),
      taxAmountPurchasePrice: aggregateMoneyField('taxAmountPurchasePrice', masterItem, absorbedItems),
      taxAmountProjectPrice: aggregateMoneyField('taxAmountProjectPrice', masterItem, absorbedItems),
      notes: buildMergedNotes(masterItem, absorbedItems)
    }

    const updatedItems = items
      .filter(item => !selectedItemIds.has(item.id) || item.id === mergeMasterId)
      .map(item => (item.id === mergeMasterId ? updatedMaster : item))

    onItemsChange(updatedItems)
    setSelectedItemIds(new Set([mergeMasterId]))
    closeMergeDialog()
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
      <div className="sticky top-0 z-10 bg-white py-3 border-b border-gray-200 mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-medium text-gray-900">Transaction Items</h3>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {selectedItemIds.size > 0 && (
                <span className="text-gray-600">{selectedItemIds.size} selected</span>
              )}
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                {selectedItemIds.size === items.length ? 'Clear selection' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={openMergeDialog}
                disabled={selectedItemIds.size < 2}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-transparent text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GitMerge className="h-4 w-4" />
                Merge Selected
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="pt-1">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.description || `item ${index + 1}`}`}
                  checked={selectedItemIds.has(item.id)}
                  onChange={(e) => toggleItemSelection(item.id, e.target.checked)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
              </div>
              {item.images && item.images.length > 0 && (
                <div className="mr-4">
                  <img
                    src={item.images.find(img => img.isPrimary)?.url || item.images[0].url}
                    alt={item.images[0].alt || item.images[0].fileName}
                    className="h-12 w-12 rounded-md object-cover border border-gray-200"
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    Item {index + 1}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatCurrency(item.projectPrice || item.purchasePrice || '')}
                    {hasNonEmptyMoneyString(item.taxAmountPurchasePrice) && (
                      <>
                        {' • Tax: '}
                        {formatCurrency(item.taxAmountPurchasePrice as string)}
                      </>
                    )}
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
                  {item.marketValue && (
                    <div>
                      <span className="font-medium">Market Value:</span> ${item.marketValue}
                    </div>
                  )}
                  {hasNonEmptyMoneyString(item.taxAmountProjectPrice) && (
                    <div>
                      <span className="font-medium">Tax on project:</span> {formatCurrency(item.taxAmountProjectPrice as string)}
                    </div>
                  )}
                </div>

                {item.notes && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {item.notes}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-auto">
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

        {/* Add Item Button - Always visible */}
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <button
            onClick={() => setIsAddingItem(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            title="Add new item"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </button>
        </div>

        {items.length > 0 && (
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total Items: {items.length}
            </div>
            <div className="text-lg font-semibold text-gray-900">
              Total: {formatCurrency(
                items.reduce((sum, item) => sum + (parseFloat(item.projectPrice || item.purchasePrice || '0') || 0), 0).toString()
              )}
            </div>
          </div>
        )}
      </div>

      {isMergeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Merge Items</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Select which item should remain. The others will be absorbed into it. Purchase price and tax amounts will be summed and the absorbed item names/SKUs will be appended to the notes.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMergeDialog}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-auto pr-1">
              {selectedItems.map(item => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="merge-master"
                    checked={mergeMasterId === item.id}
                    onChange={() => setMergeMasterId(item.id)}
                    className="mt-1 h-4 w-4 text-primary-600 border-gray-300"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.description || 'Untitled item'}</p>
                    <p className="text-xs text-gray-600">
                      SKU: {item.sku?.trim() || '—'} • Purchase price: {formatCurrency(item.purchasePrice || item.projectPrice || '0')}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeMergeDialog}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!mergeMasterId}
                onClick={handleConfirmMerge}
                className="px-4 py-2 rounded-md border border-transparent bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Merge Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
