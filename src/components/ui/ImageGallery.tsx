import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { ItemImage } from '@/types'

interface ImageGalleryProps {
  images: ItemImage[]
  initialIndex?: number
  onClose: () => void
}

export default function ImageGallery({ images, initialIndex = 0, onClose }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isLoaded, setIsLoaded] = useState(false)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, images.length])

  // Prevent body scroll when gallery is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const currentImage = images[currentIndex]

  const handlePrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
    setIsLoaded(false)
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
    setIsLoaded(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-white hover:text-gray-300 transition-colors"
        aria-label="Close gallery"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 text-white hover:text-gray-300 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 text-white hover:text-gray-300 transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Main image container */}
      <div className="relative max-w-full max-h-full flex items-center justify-center">
        <img
          src={currentImage.url}
          alt={currentImage.alt || currentImage.fileName}
          className="max-w-full max-h-full object-contain"
          onLoad={() => setIsLoaded(true)}
          style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />

        {/* Loading placeholder */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Image info bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium truncate">
              {currentImage.alt || currentImage.fileName}
            </h3>
            {currentImage.caption && (
              <p className="text-xs text-gray-300 mt-1">{currentImage.caption}</p>
            )}
            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
              <span>{currentIndex + 1} of {images.length}</span>
              <span>{formatFileSize(currentImage.size)}</span>
              <span>
                {(() => {
                  try {
                    return new Date(currentImage.uploadedAt).toLocaleDateString()
                  } catch (error) {
                    console.warn('Invalid date for image:', currentImage.uploadedAt, error)
                    return 'Unknown date'
                  }
                })()}
              </span>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={() => window.open(currentImage.url, '_blank')}
            className="p-2 text-white hover:text-gray-300 transition-colors ml-4"
            aria-label="Download image"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index)
                setIsLoaded(false)
              }}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
