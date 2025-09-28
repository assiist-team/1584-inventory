import React, { useState } from 'react'
import { Camera, X, Plus } from 'lucide-react'
import { ItemImage } from '@/types'
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

  const handleRemoveImage = (e: React.MouseEvent, imageUrl: string) => {
    e.stopPropagation()
    onRemoveImage?.(imageUrl)
  }

  const handleSetPrimary = (e: React.MouseEvent, imageUrl: string) => {
    e.stopPropagation()
    onSetPrimary?.(imageUrl)
  }

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
                className={`${sizeClasses[size]} relative group cursor-pointer rounded-lg overflow-hidden border-2 ${
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
                  <div className="absolute top-1 left-1 bg-primary-500 text-white text-xs px-1 py-0.5 rounded">
                    Primary
                  </div>
                )}

                {/* Controls overlay */}
                {showControls && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                      {!image.isPrimary && onSetPrimary && (
                        <button
                          onClick={(e) => handleSetPrimary(e, image.url)}
                          className="p-1 bg-white bg-opacity-90 rounded-full text-gray-700 hover:bg-opacity-100 transition-colors"
                          title="Set as primary"
                        >
                          <Camera className="h-3 w-3" />
                        </button>
                      )}
                      {onRemoveImage && (
                        <button
                          onClick={(e) => handleRemoveImage(e, image.url)}
                          className="p-1 bg-red-500 bg-opacity-90 rounded-full text-white hover:bg-opacity-100 transition-colors"
                          title="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Image index for non-primary images */}
                {!image.isPrimary && images.length > 1 && (
                  <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                    {index + 1}
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
