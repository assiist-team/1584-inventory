import React, { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { ImageUploadService } from '@/services/imageService'

interface ImageUploadProps {
  onImagesChange: (files: File[]) => void
  maxImages?: number
  acceptedTypes?: string[]
  maxFileSize?: number // in MB
  disabled?: boolean
  className?: string
}

interface PreviewImage {
  file: File
  previewUrl: string
  isUploading?: boolean
  uploadProgress?: number
  error?: string
}

export default function ImageUpload({
  onImagesChange,
  maxImages = 5,
  acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  maxFileSize = 10,
  disabled = false,
  className = ''
}: ImageUploadProps) {
  const [images, setImages] = useState<PreviewImage[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Invalid file type. Please upload: ${acceptedTypes.join(', ')}`
    }

    const maxSizeBytes = maxFileSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size: ${maxFileSize}MB`
    }

    return null
  }, [acceptedTypes, maxFileSize])

  const addImages = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const newPreviewImages: PreviewImage[] = []

    fileArray.forEach(file => {
      const error = validateFile(file)
      if (error) {
        newPreviewImages.push({
          file,
          previewUrl: '',
          error
        })
      } else {
        validFiles.push(file)
        newPreviewImages.push({
          file,
          previewUrl: ImageUploadService.createPreviewUrl(file)
        })
      }
    })

    if (validFiles.length + images.length > maxImages) {
      const allowedCount = maxImages - images.length
      if (allowedCount > 0) {
        validFiles.splice(allowedCount)
        newPreviewImages.splice(allowedCount)
      } else {
        validFiles.length = 0
        newPreviewImages.length = 0
      }

      newPreviewImages.push({
        file: new File([], ''),
        previewUrl: '',
        error: `Maximum ${maxImages} images allowed. Additional images were skipped.`
      })
    }

    setImages(prev => [...prev, ...newPreviewImages])
    onImagesChange(validFiles)
  }, [images.length, maxImages, validateFile, onImagesChange])

  const removeImage = useCallback((index: number) => {
    const imageToRemove = images[index]

    // Clean up preview URL
    if (imageToRemove.previewUrl) {
      ImageUploadService.revokePreviewUrl(imageToRemove.previewUrl)
    }

    setImages(prev => prev.filter((_, i) => i !== index))

    // Update parent component with remaining files
    const remainingFiles = images
      .filter((_, i) => i !== index)
      .filter(img => !img.error)
      .map(img => img.file)

    onImagesChange(remainingFiles)
  }, [images, onImagesChange])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      addImages(files)
    }
  }


  const handleGallerySelect = async () => {
    try {
      const files = await ImageUploadService.selectFromGallery()
      if (files.length > 0) {
        addImages(files)
      }
    } catch (error) {
      console.error('Error selecting from gallery:', error)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      addImages(files)
    }
  }, [disabled, addImages])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + sizes[i]
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors touch-manipulation ${
          isDragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center space-y-2">
          <div className={`p-3 rounded-full ${isDragOver ? 'bg-primary-100' : 'bg-gray-100'}`}>
            <Upload className={`h-6 w-6 ${isDragOver ? 'text-primary-600' : 'text-gray-600'}`} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900">
              Drop images here, or click to browse
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports: JPEG, PNG, GIF, WebP (max {maxFileSize}MB each, up to {maxImages} images)
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleGallerySelect()
            }}
            disabled={disabled}
            className="inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 mt-3 touch-manipulation"
            title="Add images from gallery or camera"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Add Images
          </button>
        </div>
      </div>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Hidden gallery input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Transaction Images</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <div className="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-gray-100">
                  {image.error ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-4">
                        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <p className="text-xs text-red-600">{image.error}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <img
                        src={image.previewUrl}
                        alt={image.file.name}
                        className="w-full h-full object-cover"
                      />

                      {image.isUploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="text-white text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
                            <p className="text-xs">
                              {image.uploadProgress ? `${Math.round(image.uploadProgress)}%` : 'Uploading...'}
                            </p>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-1">
                  <p className="text-xs text-gray-500 truncate" title={image.file.name}>
                    {image.file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(image.file.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
