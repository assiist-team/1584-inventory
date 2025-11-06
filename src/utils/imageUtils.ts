import { TransactionImage } from '@/types'

export interface ImageValidationResult {
  isValid: boolean
  error?: string
}

export interface ImageCompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  maxSizeKB?: number
}

export interface EXIFData {
  make?: string
  model?: string
  datetime?: string
  orientation?: number
  width?: number
  height?: number
  [key: string]: any
}

/**
 * Validates an image file for upload
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff'
  ]

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Please upload one of: ${allowedTypes.join(', ')}`
    }
  }

  // Check file size (25MB limit for high-quality receipts)
  const maxSize = 25 * 1024 * 1024 // 25MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File too large. Maximum size: 25MB'
    }
  }

  // Check minimum size
  const minSize = 1024 // 1KB
  if (file.size < minSize) {
    return {
      isValid: false,
      error: 'File too small. Minimum size: 1KB'
    }
  }

  return { isValid: true }
}

/**
 * Compresses an image file to reduce size while maintaining quality
 */
export function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    format = 'jpeg',
    maxSizeKB = 2048
  } = options

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width *= ratio
        height *= ratio
      }

      canvas.width = width
      canvas.height = height

      // Draw image
      ctx?.drawImage(img, 0, 0, width, height)

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            let compressedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: Date.now()
            })

            // If still too large, compress further
            if (blob.size > maxSizeKB * 1024) {
              // Reduce quality and try again
              canvas.toBlob(
                (blob2) => {
                  if (blob2) {
                    compressedFile = new File([blob2], file.name, {
                      type: `image/${format}`,
                      lastModified: Date.now()
                    })
                  }
                  resolve(compressedFile)
                },
                `image/${format}`,
                quality * 0.7
              )
            } else {
              resolve(compressedFile)
            }
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        `image/${format}`,
        quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Resizes an image to specific dimensions
 */
export function resizeImage(
  file: File,
  targetWidth: number,
  targetHeight: number,
  maintainAspectRatio: boolean = true
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      let { width, height } = img

      if (maintainAspectRatio) {
        const ratio = Math.min(targetWidth / width, targetHeight / height)
        width *= ratio
        height *= ratio
      } else {
        width = targetWidth
        height = targetHeight
      }

      canvas.width = targetWidth
      canvas.height = targetHeight

      // Clear canvas with white background
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, targetWidth, targetHeight)
      }

      // Draw and resize image
      ctx?.drawImage(img, 0, 0, targetWidth, targetHeight)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(resizedFile)
          } else {
            reject(new Error('Failed to resize image'))
          }
        },
        file.type,
        0.9
      )
    }

    img.onerror = () => reject(new Error('Failed to load image for resizing'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Converts an image to a different format
 */
export function convertImageFormat(
  file: File,
  targetFormat: 'jpeg' | 'png' | 'webp',
  quality: number = 0.9
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height

      // Draw image
      ctx?.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const newName = file.name.replace(/\.[^.]+$/, `.${targetFormat}`)
            const convertedFile = new File([blob], newName, {
              type: `image/${targetFormat}`,
              lastModified: Date.now()
            })
            resolve(convertedFile)
          } else {
            reject(new Error('Failed to convert image format'))
          }
        },
        `image/${targetFormat}`,
        quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image for format conversion'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Extracts basic EXIF data from an image (simplified implementation)
 * Note: This is a basic implementation. For full EXIF support, consider using a library like exifr
 */
export function extractEXIFData(file: File): Promise<EXIFData> {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      const exifData: EXIFData = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        orientation: 1
      }
      resolve(exifData)
    }

    img.onerror = () => resolve({
      width: 0,
      height: 0,
      orientation: 1
    })

    img.src = URL.createObjectURL(file)
  })
}

/**
 * Applies EXIF orientation to correctly rotate the image
 */
export function applyEXIFOrientation(file: File, orientation: number): Promise<File> {
  if (orientation === 1) {
    return Promise.resolve(file) // No rotation needed
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      let { width, height } = img

      // Apply transformations based on orientation
      switch (orientation) {
        case 3:
        case 4:
          // 180 degrees
          ctx?.translate(width, height)
          ctx?.rotate(Math.PI)
          break
        case 5:
        case 6:
          // 90 degrees clockwise
          canvas.width = height
          canvas.height = width
          ctx?.translate(height, 0)
          ctx?.rotate(Math.PI / 2)
          ;[width, height] = [height, width]
          break
        case 7:
        case 8:
          // 90 degrees counter-clockwise
          canvas.width = height
          canvas.height = width
          ctx?.translate(0, width)
          ctx?.rotate(-Math.PI / 2)
          ;[width, height] = [height, width]
          break
      }

      ctx?.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const correctedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(correctedFile)
          } else {
            reject(new Error('Failed to apply EXIF orientation'))
          }
        },
        file.type,
        0.9
      )
    }

    img.onerror = () => reject(new Error('Failed to load image for orientation correction'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Creates a thumbnail from an image
 */
export function createThumbnail(file: File, size: number = 150): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      const { width, height } = img
      const ratio = Math.min(size / width, size / height)

      canvas.width = width * ratio
      canvas.height = height * ratio

      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailName = file.name.replace(/\.[^.]+$/, '_thumb.jpg')
            const thumbnailFile = new File([blob], thumbnailName, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(thumbnailFile)
          } else {
            reject(new Error('Failed to create thumbnail'))
          }
        },
        'image/jpeg',
        0.8
      )
    }

    img.onerror = () => reject(new Error('Failed to load image for thumbnail creation'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + sizes[i]
}

/**
 * Calculates the estimated compressed size of an image
 */
export function estimateCompressedSize(
  originalSize: number,
  quality: number = 0.8,
  format: 'jpeg' | 'png' | 'webp' = 'jpeg'
): number {
  // Rough estimation based on format and quality
  const formatMultiplier = {
    jpeg: 0.1 + (1 - quality) * 0.3, // JPEG compression is more effective
    png: 0.6, // PNG compression is less effective
    webp: 0.05 + (1 - quality) * 0.25 // WebP is very efficient
  }

  return Math.round(originalSize * (formatMultiplier[format] || 0.3))
}

/**
 * Checks if the browser supports a specific image format
 */
export function supportsImageFormat(format: string): boolean {
  const canvas = document.createElement('canvas')
  return canvas.toDataURL(`image/${format}`).indexOf(`image/${format}`) === 5
}

/**
 * Gets the optimal image format supported by the browser
 */
export function getOptimalImageFormat(): 'webp' | 'jpeg' | 'png' {
  if (supportsImageFormat('webp')) return 'webp'
  if (supportsImageFormat('jpeg')) return 'jpeg'
  return 'png'
}

/**
 * Converts TransactionImage array to a more compact format for storage/transmission
 */
export function serializeTransactionImages(images: TransactionImage[]): any[] {
  return images.map(img => ({
    url: img.url,
    fileName: img.fileName,
    uploadedAt: img.uploadedAt.toISOString(),
    size: img.size,
    mimeType: img.mimeType
  }))
}

/**
 * Converts serialized transaction images back to TransactionImage objects
 */
export function deserializeTransactionImages(images: any[]): TransactionImage[] {
  return images.map(img => ({
    url: img.url,
    fileName: img.fileName,
    uploadedAt: new Date(img.uploadedAt),
    size: img.size,
    mimeType: img.mimeType
  }))
}

/**
 * Enhanced error handling for image upload operations
 */
export class ImageUploadError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'ImageUploadError'
  }
}

/**
 * Creates user-friendly error messages for common upload issues
 * Handles Supabase storage errors
 */
export function getUserFriendlyErrorMessage(error: any): string {
  if (error instanceof ImageUploadError) {
    return error.message
  }

  // Handle Supabase storage errors (statusCode-based)
  if (error?.statusCode) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return 'You need to sign in to upload images. Please refresh the page and try again.'
      case 413:
        return 'File too large. Please upload a smaller image.'
      case 404:
        return 'Storage bucket not found. Please contact support.'
      case 409:
        return 'File already exists. Please try again with a different name.'
      default:
        return `Upload failed: ${error.message || 'Unknown error'}. Please try again.`
    }
  }

  // Handle Supabase storage errors
  if (error?.message) {
    const message = error.message.toLowerCase()
    
    if (message.includes('timeout')) {
      return 'Upload timed out. Please try again with a smaller image or check your connection.'
    }
    if (message.includes('network') || message.includes('offline')) {
      return 'Network error. Please check your internet connection and try again.'
    }
    if (message.includes('cors')) {
      return 'Access error. Please refresh the page and try again.'
    }
    if (message.includes('permission') || message.includes('auth') || message.includes('unauthorized')) {
      return 'Permission error. Please sign in and try again.'
    }
    if (message.includes('quota') || message.includes('limit')) {
      return 'Storage limit reached. Please contact support or delete some old images.'
    }
    if (message.includes('bucket') && message.includes('not found')) {
      return 'Storage bucket not found. Please contact support.'
    }
  }

  return 'Failed to upload image. Please try again.'
}

/**
 * Determines if an error is retryable
 * Handles Supabase storage errors
 */
export function isRetryableError(error: any): boolean {
  // Supabase errors with retryable status codes
  if (error?.statusCode) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504]
    return retryableStatusCodes.includes(error.statusCode)
  }

  // Supabase errors with retryable codes
  if (error?.code) {
    const retryableCodes = [
      'storage/retry-limit-exceeded',
      'storage/network-error',
      'storage/timeout'
    ]
    return retryableCodes.includes(error.code)
  }

  // Check error message for retryable keywords
  if (error?.message) {
    const message = error.message.toLowerCase()
    const retryableMessages = [
      'timeout',
      'network',
      'offline',
      'connection',
      'server error',
      'service unavailable'
    ]
    return retryableMessages.some(msg => message.includes(msg))
  }

  return false
}

/**
 * Gets suggested actions for common errors
 * Handles Supabase storage errors
 */
export function getErrorAction(error: any): string {
  // Supabase errors
  if (error?.statusCode === 401 || error?.statusCode === 403) {
    return 'Try refreshing the page to sign in again.'
  }
  if (error?.statusCode === 413) {
    return 'Try uploading a smaller image file.'
  }
  
  // Supabase storage errors
  if (error?.message?.includes('unauthorized') || error?.message?.includes('permission')) {
    return 'Try refreshing the page to sign in again.'
  }
  if (error?.code === 'storage/quota-exceeded') {
    return 'Contact support or delete some old images to free up space.'
  }
  if (error?.code === 'storage/invalid-format') {
    return 'Use JPEG, PNG, GIF, or WebP format images.'
  }
  
  // Generic error messages
  if (error?.message) {
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('timeout')) {
      return 'Check your internet connection and try again.'
    }
    if (message.includes('quota') || message.includes('limit')) {
      return 'Contact support or delete some old images to free up space.'
    }
  }
  
  return 'Try again in a few moments.'
}
