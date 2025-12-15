import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { ItemImage } from '@/types'

interface ImageGalleryProps {
  images: ItemImage[]
  initialIndex?: number
  onClose: () => void
}

export default function ImageGallery({ images, initialIndex = 0, onClose }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isLoaded, setIsLoaded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Reset zoom and pan when image changes
  useEffect(() => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [currentIndex])

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.5, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.5, 1)
      if (newZoom === 1) {
        setPanX(0)
        setPanY(0)
      }
      return newZoom
    })
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If zoomed, allow panning with arrow keys
      if (zoom > 1) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            setPanX(prev => Math.min(0, prev + 50))
            return
          case 'ArrowRight':
            e.preventDefault()
            setPanX(prev => Math.max(0, prev - 50))
            return
          case 'ArrowUp':
            e.preventDefault()
            setPanY(prev => Math.min(0, prev + 50))
            return
          case 'ArrowDown':
            e.preventDefault()
            setPanY(prev => Math.max(0, prev - 50))
            return
        }
      }

      switch (e.key) {
        case 'Escape':
          if (zoom > 1) {
            // Reset zoom first
            handleResetZoom()
          } else {
            onClose()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
          break
        case '+':
        case '=':
          e.preventDefault()
          handleZoomIn()
          break
        case '-':
        case '_':
          e.preventDefault()
          handleZoomOut()
          break
        case '0':
          e.preventDefault()
          handleResetZoom()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, images.length, zoom, handleZoomIn, handleZoomOut, handleResetZoom])

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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.2 : 0.2
    const newZoom = Math.max(1, Math.min(5, zoom + delta))
    setZoom(newZoom)
    if (newZoom === 1) {
      setPanX(0)
      setPanY(0)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanX(e.clientX - dragStart.x)
      setPanY(e.clientY - dragStart.y)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch handlers for pinch-to-zoom and pan
  const touchStartRef = useRef<{ distance: number; centerX: number; centerY: number } | null>(null)

  const getTouchDistance = (touches: React.TouchList): number => {
    const touch1 = touches[0]
    const touch2 = touches[1]
    return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
  }

  const getTouchCenter = (touches: React.TouchList): { x: number; y: number } => {
    const touch1 = touches[0]
    const touch2 = touches[1]
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches)
      const center = getTouchCenter(e.touches)
      touchStartRef.current = { distance, centerX: center.x, centerY: center.y }
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      e.preventDefault()
      const currentDistance = getTouchDistance(e.touches)
      const startDistance = touchStartRef.current.distance
      const scale = currentDistance / startDistance
      const newZoom = Math.max(1, Math.min(5, zoom * scale))
      setZoom(newZoom)
      if (newZoom === 1) {
        setPanX(0)
        setPanY(0)
      }
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      e.preventDefault()
      setPanX(e.touches[0].clientX - dragStart.x)
      setPanY(e.touches[0].clientY - dragStart.y)
    }
  }

  const handleTouchEnd = () => {
    touchStartRef.current = null
    setIsDragging(false)
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

      {/* Zoom controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-colors rounded"
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 1}
          className="p-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        {zoom > 1 && (
          <button
            onClick={handleResetZoom}
            className="p-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-colors rounded"
            aria-label="Reset zoom"
            title="Reset zoom (0)"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main image container */}
      <div
        ref={imageContainerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imageRef}
          src={currentImage.url}
          alt={currentImage.alt || currentImage.fileName}
          className="max-w-full max-h-full object-contain select-none"
          onLoad={() => setIsLoaded(true)}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: zoom === 1 ? 'opacity 0.3s ease' : 'none',
            transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
            cursor: zoom > 1 ? 'grab' : 'default'
          }}
          draggable={false}
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
