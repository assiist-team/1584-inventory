import { Bookmark, Camera, ChevronDown, Edit, Copy } from 'lucide-react'
import ContextLink from '@/components/ContextLink'
import { Item } from '@/types'
import { normalizeDisposition, dispositionsEqual, displayDispositionLabel, DISPOSITION_OPTIONS } from '@/utils/dispositionUtils'
import type { ItemDisposition } from '@/types'

interface InventoryItemRowProps {
  item: Item
  isSelected: boolean
  onSelect: (itemId: string, checked: boolean) => void
  onBookmark: (itemId: string) => void
  onDuplicate: (itemId: string) => void
  onEdit: (href: string) => void
  onDispositionUpdate: (itemId: string, disposition: ItemDisposition) => void
  onAddImage: (itemId: string) => void
  uploadingImages: Set<string>
  openDispositionMenu: string | null
  setOpenDispositionMenu: (itemId: string | null) => void
  context: 'project' | 'businessInventory'
  projectId?: string // Required for project context
}

export default function InventoryItemRow({
  item,
  isSelected,
  onSelect,
  onBookmark,
  onDuplicate,
  onEdit,
  onDispositionUpdate,
  onAddImage,
  uploadingImages,
  openDispositionMenu,
  setOpenDispositionMenu,
  context,
  projectId
}: InventoryItemRowProps) {
  const getDispositionBadgeClasses = (disposition?: string | null) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors hover:opacity-80'
    const d = normalizeDisposition(disposition)

    switch (d) {
      case 'to purchase':
        return `${baseClasses} bg-amber-100 text-amber-800`
      case 'purchased':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'to return':
        return `${baseClasses} bg-red-100 text-red-700`
      case 'returned':
        return `${baseClasses} bg-red-800 text-red-100`
      case 'inventory':
        return `${baseClasses} bg-primary-100 text-primary-600`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const toggleDispositionMenu = (itemId: string) => {
    setOpenDispositionMenu(openDispositionMenu === itemId ? null : itemId)
  }

  const updateDisposition = async (itemId: string, newDisposition: ItemDisposition) => {
    onDispositionUpdate(itemId, newDisposition)
    setOpenDispositionMenu(null)
  }

  // Determine the link destination based on context
  const getItemLink = () => {
    if (context === 'project' && projectId) {
      return `/item/${item.itemId}?project=${projectId}`
    } else if (context === 'businessInventory') {
      return `/business-inventory/${item.itemId}`
    }
    return `/item/${item.itemId}`
  }

  // Determine the edit link based on context
  const getEditLink = () => {
    if (context === 'project' && projectId) {
      return `/project/${projectId}/item/${item.itemId}/edit`
    } else if (context === 'businessInventory') {
      return `/business-inventory/${item.itemId}/edit`
    }
    return `/item/${item.itemId}/edit`
  }

  return (
    <li className="relative bg-gray-50 transition-colors duration-200 hover:bg-gray-100">
      {/* Top row: Controls - stays outside Link */}
      <div className="flex items-center justify-between mb-0 px-4 py-3">
        <div className="flex items-center">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 flex-shrink-0"
            checked={isSelected}
            onChange={(e) => onSelect(item.itemId, e.target.checked)}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onBookmark(item.itemId)
            }}
            className={`inline-flex items-center justify-center p-2 border text-sm font-medium rounded-md transition-colors ${
              item.bookmark
                ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            title={item.bookmark ? 'Remove Bookmark' : 'Add Bookmark'}
          >
            <Bookmark className="h-4 w-4" fill={item.bookmark ? 'currentColor' : 'none'} />
          </button>
          <ContextLink
            to={getEditLink()}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(getEditLink())
            }}
            className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            title="Edit item"
          >
            <Edit className="h-4 w-4" />
          </ContextLink>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDuplicate(item.itemId)
            }}
            className="inline-flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            title="Duplicate item"
          >
            <Copy className="h-4 w-4" />
          </button>
            <div className="relative ml-1">
              <span
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleDispositionMenu(item.itemId)
                }}
              className={`disposition-badge ${getDispositionBadgeClasses(item.disposition)}`}
              >
                {displayDispositionLabel(item.disposition) || 'Not Set'}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </span>

                {/* Dropdown menu */}
                {openDispositionMenu === item.itemId && (
                  <div className="disposition-menu absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="py-1">
                      {DISPOSITION_OPTIONS.map((disposition) => (
                        <button
                          key={disposition}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            updateDisposition(item.itemId, disposition)
                          }}
                          className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                            dispositionsEqual(item.disposition, disposition) ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          }`}
                          disabled={!item.disposition}
                        >
                          {displayDispositionLabel(disposition)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* Main tappable content - wrapped in Link */}
      <ContextLink to={getItemLink()}>
        <div className="block bg-transparent">
          <div className="px-4 pb-3 sm:px-6">
            {/* Middle row: Thumbnail and Description - now tappable */}
            <div className="flex items-center gap-3 py-3">
              <div className="flex-shrink-0">
                {item.images && item.images.length > 0 ? (
                  // Show primary image thumbnail or first image if no primary
                  (() => {
                    const primaryImage = item.images.find(img => img.isPrimary) || item.images[0]
                    return (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                          src={primaryImage.url}
                          alt={primaryImage.alt || 'Item image'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )
                  })()
                ) : (
                  // Show camera placeholder when no images
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onAddImage(item.itemId)
                    }}
                    disabled={uploadingImages.has(item.itemId)}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors disabled:opacity-50"
                    title="Add image (camera or gallery)"
                  >
                    <Camera className="h-6 w-6" />
                  </button>
                )}
              </div>

              {/* Item description - now tappable */}
              <div className="flex-1 min-w-0 flex items-center">
                <div>
                  <h3 className="text-base font-medium text-gray-900 line-clamp-2 break-words">
                    {item.description}
                  </h3>
                  {/* Space/Location field */}
                  {context === 'project' && item.space && (
                    <p className="text-sm text-gray-600 mt-1">
                      {item.space}
                    </p>
                  )}
                  {context === 'businessInventory' && item.businessInventoryLocation && (
                    <p className="text-sm text-gray-600 mt-1">
                      {item.businessInventoryLocation}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom row: Content - now tappable */}
            <div className="space-y-2">
              {/* Project Price (or Purchase Price if project price not set), Source, SKU on same row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                {(item.projectPrice || item.purchasePrice) && (
                  <span className="font-medium text-gray-700">${item.projectPrice || item.purchasePrice}</span>
                )}
                {item.source && (
                  <>
                    {(item.projectPrice || item.purchasePrice) && <span className="hidden sm:inline">•</span>}
                    <span className="font-medium text-gray-700">{item.source}</span>
                  </>
                )}
                {item.sku && (
                  <>
                    {(item.projectPrice || item.purchasePrice || item.source) && <span className="hidden sm:inline">•</span>}
                    <span className="font-medium text-gray-700">{item.sku}</span>
                  </>
                )}
              </div>

              {/* Notes (only shown for business inventory) */}
              {context === 'businessInventory' && item.notes && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {item.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      </ContextLink>
    </li>
  )
}