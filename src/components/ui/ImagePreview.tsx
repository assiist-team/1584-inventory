import React, { useState, useEffect } from 'react'
import { Plus, ChevronDown, Trash2, Star, ExternalLink, Crown } from 'lucide-react'
import { ItemImage, TransactionImage } from '@/types'
import ImageGallery from './ImageGallery'

interface ImagePreviewProps {
  images: ItemImage[]
  onAddImage?: () => void
  onRemoveImage?: (imageUrl: string) => void
  onSetPrimary?: (imageUrl: string) => void
  maxImages?: number
  showControls?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

interface TransactionImagePreviewProps {
  images: TransactionImage[]
  onRemoveImage?: (imageUrl: string) => void
  maxImages?: number
  showControls?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onImageClick?: (index: number) => void
}

export default function ImagePreview({
  images,
  onAddImage,
  onRemoveImage,
  onSetPrimary,
  maxImages = 5,
  showControls = true,
  size = 'md',
  className = ''
}: ImagePreviewProps) {
  const [showGallery, setShowGallery] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null)

  const sizeClasses = {
    sm: 'w-20 h-20 sm:w-16 sm:h-16',
    md: 'w-24 h-24 sm:w-20 sm:h-20',
    lg: 'w-28 h-28 sm:w-24 sm:h-24'
  }

  const handleImageClick = (index: number) => {
    setGalleryInitialIndex(index)
    setShowGallery(true)
  }

  const handleGalleryClose = () => {
    setShowGallery(false)
  }


  const toggleMenu = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setOpenMenuIndex(openMenuIndex === index ? null : index)
  }

  const handleMenuAction = (e: React.MouseEvent, action: string, imageUrl: string, index: number) => {
    e.stopPropagation()
    setOpenMenuIndex(null)

    switch (action) {
      case 'open':
        handleImageClick(index)
        break
      case 'setPrimary':
        onSetPrimary?.(imageUrl)
        break
      case 'delete':
        onRemoveImage?.(imageUrl)
        break
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuIndex !== null && !(e.target as Element).closest('.image-menu-container')) {
        setOpenMenuIndex(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openMenuIndex])

  if (images.length === 0 && !onAddImage) {
    return null
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {/* Images grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6" style={{width: 'fit-content'}}>
            {images.map((image, index) => (
              <div
                key={image.url}
                className={`${sizeClasses[size]} relative group cursor-pointer rounded-lg overflow-visible border-2 ${
                  image.isPrimary ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
                }`}
                onClick={() => handleImageClick(index)}
              >
                <img
                  src={image.url}
                  alt={image.alt || image.fileName}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />

                {/* Primary indicator */}
                {image.isPrimary && (
                  <div className="absolute top-1 left-1 bg-primary-500 bg-opacity-40 text-white text-xs p-1 rounded flex items-center justify-center border border-white">
                    <Crown className="h-3 w-3 fill-current" />
                  </div>
                )}

                {/* Controls overlay - Mobile-first design with chevron menu */}
                {showControls && (
                  <div className="absolute inset-0 bg-transparent transition-all duration-200">
                    {/* Chevron menu button - Upper right corner */}
                    <div className="absolute top-1 right-1 image-menu-container">
                      <button
                        onClick={(e) => toggleMenu(e, index)}
                        className="p-1.5 bg-primary-500 bg-opacity-40 rounded-full text-white border border-white hover:bg-primary-500 hover:bg-opacity-50 hover:text-white transition-colors"
                        title="Image options"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>

                      {/* Dropdown menu */}
                      {openMenuIndex === index && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50" style={{
                          transform: 'translateY(0)',
                          maxHeight: 'calc(100vh - 100px)',
                          overflowY: 'auto'
                        }}>
                          <button
                            onClick={(e) => handleMenuAction(e, 'open', image.url, index)}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center transition-colors"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            <span>Open</span>
                          </button>
                          {!image.isPrimary && onSetPrimary && (
                            <button
                              onClick={(e) => handleMenuAction(e, 'setPrimary', image.url, index)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center transition-colors"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              <span>Primary</span>
                            </button>
                          )}
                          {onRemoveImage && (
                            <button
                              onClick={(e) => handleMenuAction(e, 'delete', image.url, index)}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            ))}

            {/* Add image button */}
            {onAddImage && images.length < maxImages && (
              <button
                onClick={onAddImage}
                className={`${sizeClasses[size]} border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors`}
                title="Add image"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Add image button when no images exist */}
        {!images.length && onAddImage && (
          <button
            onClick={onAddImage}
            className={`${sizeClasses[size]} border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors w-full`}
            title="Add image"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}

        {/* Image count */}
        {images.length > 0 && (
          <p className="text-xs text-gray-500">
            {images.length} image{images.length !== 1 ? 's' : ''}
            {maxImages && ` (max ${maxImages})`}
          </p>
        )}
      </div>

      {/* Image gallery modal */}
      {showGallery && (
        <ImageGallery
          images={images}
          initialIndex={galleryInitialIndex}
          onClose={handleGalleryClose}
        />
      )}
    </>
  )
}

// Transaction Image Preview Component - for receipt and other transaction images
// This component is similar to ImagePreview but without the Primary option
export function TransactionImagePreview({
  images,
  onRemoveImage,
  showControls = true,
  size = 'md',
  className = '',
  onImageClick
}: TransactionImagePreviewProps) {
  const [showGallery, setShowGallery] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null)

  const sizeClasses = {
    sm: 'w-20 h-20 sm:w-16 sm:h-16',
    md: 'w-24 h-24 sm:w-20 sm:h-20',
    lg: 'w-28 h-28 sm:w-24 sm:h-24'
  }

  const handleImageClick = (index: number) => {
    if (onImageClick) {
      onImageClick(index)
    } else {
      setGalleryInitialIndex(index)
      setShowGallery(true)
    }
  }

  const handleGalleryClose = () => {
    setShowGallery(false)
  }

  const toggleMenu = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setOpenMenuIndex(openMenuIndex === index ? null : index)
  }

  const handleMenuAction = (e: React.MouseEvent, action: string, imageUrl: string, index: number) => {
    e.stopPropagation()
    setOpenMenuIndex(null)

    switch (action) {
      case 'open':
        handleImageClick(index)
        break
      case 'delete':
        onRemoveImage?.(imageUrl)
        break
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuIndex !== null && !(e.target as Element).closest('.image-menu-container')) {
        setOpenMenuIndex(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openMenuIndex])

  if (images.length === 0) {
    return null
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {/* Images grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6" style={{width: 'fit-content'}}>
          {images.map((image, index) => (
            <div
              key={image.url}
              className={`${sizeClasses[size]} relative group cursor-pointer rounded-lg overflow-visible border-2 border-gray-200`}
              onClick={() => handleImageClick(index)}
            >
              <img
                src={image.url}
                alt={image.fileName}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />

              {/* Controls overlay - Mobile-first design with chevron menu */}
              {showControls && (
                <div className="absolute inset-0 bg-transparent transition-all duration-200">
                  {/* Chevron menu button - Upper right corner */}
                  <div className="absolute top-1 right-1 image-menu-container">
                    <button
                      onClick={(e) => toggleMenu(e, index)}
                      className="p-1.5 bg-primary-500 bg-opacity-40 rounded-full text-white border border-white hover:bg-primary-500 hover:bg-opacity-50 hover:text-white transition-colors"
                      title="Image options"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>

                    {/* Dropdown menu */}
                    {openMenuIndex === index && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50" style={{
                        transform: 'translateY(0)',
                        maxHeight: 'calc(100vh - 100px)',
                        overflowY: 'auto'
                      }}>
                        <button
                          onClick={(e) => handleMenuAction(e, 'open', image.url, index)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center transition-colors"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          <span>Open</span>
                        </button>
                        {onRemoveImage && (
                          <button
                            onClick={(e) => handleMenuAction(e, 'delete', image.url, index)}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Image gallery modal */}
      {showGallery && (
        <ImageGallery
          images={images.map(img => ({
            url: img.url,
            alt: img.fileName,
            isPrimary: false,
            uploadedAt: new Date(),
            fileName: img.fileName,
            size: 0,
            mimeType: 'image/jpeg'
          }))}
          initialIndex={galleryInitialIndex}
          onClose={handleGalleryClose}
        />
      )}
    </>
  )
}
