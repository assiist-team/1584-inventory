import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getMetadata
} from 'firebase/storage'
import { storage, ensureAuthenticatedForStorage } from './firebase'
import { TransactionImage } from '@/types'
import {
  ImageUploadError,
  getUserFriendlyErrorMessage
} from '@/utils/imageUtils'


export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface ImageUploadResult {
  url: string
  fileName: string
  size: number
  mimeType: string
}

export class ImageUploadService {
  /**
   * Check if Firebase Storage is available
   */
  static async checkStorageAvailability(): Promise<boolean> {
    try {
      if (!storage) {
        console.error('Firebase Storage not initialized')
        return false
      }
      return true
    } catch (error) {
      console.error('Storage availability check failed:', error)
      return false
    }
  }

  /**
   * Ensure user is authenticated before storage operations
   */
  static async ensureAuthentication(): Promise<void> {
    try {
      // Use the enhanced authentication function that includes proper verification
      await ensureAuthenticatedForStorage()
    } catch (error) {
      console.error('Failed to ensure authentication:', error)
      throw new Error('Authentication required for storage operations. Please refresh the page and try again.')
    }
  }

  /**
   * Upload an item image to Firebase Storage
   */
  static async uploadItemImage(
    file: File,
    projectName: string,
    itemId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, itemId, 'item_images', onProgress, retryCount)
  }

  /**
   * Upload a transaction image to Firebase Storage (legacy method for backward compatibility)
   */
  static async uploadTransactionImage(
    file: File,
    projectName: string,
    transactionId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, transactionId, 'transaction_images', onProgress, retryCount)
  }

  /**
   * Upload a receipt image to Firebase Storage
   */
  static async uploadReceiptImage(
    file: File,
    projectName: string,
    transactionId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, transactionId, 'receipt_images', onProgress, retryCount)
  }

  /**
   * Upload an other image to Firebase Storage
   */
  static async uploadOtherImage(
    file: File,
    projectName: string,
    transactionId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, transactionId, 'other_images', onProgress, retryCount)
  }

  /**
   * Upload a business logo to Firebase Storage
   */
  static async uploadBusinessLogo(
    accountId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    const MAX_RETRIES = 3

    console.log(`Upload attempt ${retryCount + 1}/${MAX_RETRIES + 1}`)

    // Ensure authentication is established before storage operations
    await this.ensureAuthentication()

    // Check storage availability
    const isStorageAvailable = await this.checkStorageAvailability()
    if (!isStorageAvailable) {
      throw new Error('Storage service is not available. Please check your connection and try again.')
    }

    // Validate and potentially compress file for mobile
    let processedFile = file
    if (this.shouldCompressForMobile(file)) {
      console.log('Compressing file for mobile upload...')
      processedFile = await this.compressForMobile(file)
    }

    if (!this.validateImageFile(processedFile)) {
      throw new Error('Invalid image file. Please upload a valid image (JPEG, PNG, GIF, WebP) under 10MB.')
    }

    // Generate unique filename: accounts/{accountId}/business_profile/logo/{timestamp}_{sanitizedFileName}
    const timestamp = Date.now()
    const sanitizedFileName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `accounts/${accountId}/business_profile/logo/${timestamp}_${sanitizedFileName}`

    console.log('Uploading logo to path:', fileName, 'Size:', processedFile.size, 'Type:', processedFile.type)

    // Create storage reference
    const storageRef = ref(storage, fileName)

    try {
      // Upload with progress tracking using uploadBytesResumable
      const uploadTask = uploadBytesResumable(storageRef, processedFile);

      if (onProgress) {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = {
              loaded: snapshot.bytesTransferred,
              total: snapshot.totalBytes,
              percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            }
            onProgress(progress)
          },
          (error) => {
            console.error('Upload error:', error)
            if (error.code === 'storage/retry-limit-exceeded' && retryCount < MAX_RETRIES) {
              console.log(`Retrying upload (${retryCount + 1}/${MAX_RETRIES})...`)
              // Retry with exponential backoff
              setTimeout(() => {
                this.uploadBusinessLogo(accountId, processedFile, onProgress, retryCount + 1)
              }, Math.pow(2, retryCount) * 1000)
            } else {
              throw new Error('Failed to upload image. Please try again.')
            }
          }
        )
      }

      // Wait for upload to complete with timeout
      const snapshot = await Promise.race([
        uploadTask,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), 60000)
        )
      ]) as any

      // Get download URL for authenticated users
      const downloadURL = await getDownloadURL(snapshot.ref)

      console.log('Logo upload successful:', downloadURL)

      return {
        url: downloadURL,
        fileName: processedFile.name,
        size: processedFile.size,
        mimeType: processedFile.type
      }
    } catch (error: any) {
      console.error('Error uploading logo:', error)

      // Handle specific Firebase errors
      if (error.code === 'storage/retry-limit-exceeded' && retryCount < MAX_RETRIES) {
        console.log(`Retrying upload due to retry limit exceeded (${retryCount + 1}/${MAX_RETRIES})...`)
        // Wait a bit longer for retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 2000))
        return this.uploadBusinessLogo(accountId, processedFile, onProgress, retryCount + 1)
      }

      if (error.message?.includes('timeout') || error.message?.includes('Upload timeout')) {
        if (retryCount < MAX_RETRIES) {
          console.log('Upload timed out, retrying with smaller file...')
          const compressedFile = await this.compressForMobile(processedFile)
          return this.uploadBusinessLogo(accountId, compressedFile, onProgress, retryCount + 1)
        } else {
          throw new Error('Upload timed out. Please try again with a smaller image or check your connection.')
        }
      }

      // Use enhanced error handling
      const friendlyMessage = getUserFriendlyErrorMessage(error)
      throw new ImageUploadError(friendlyMessage, error.code, error)
    }
  }

  /**
   * Internal upload method with the new storage structure
   */
  private static async uploadImageInternal(
    file: File,
    projectName: string,
    id: string,
    imageType: 'item_images' | 'transaction_images' | 'receipt_images' | 'other_images',
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    const MAX_RETRIES = 3

    console.log(`Upload attempt ${retryCount + 1}/${MAX_RETRIES + 1}`)

    // Ensure authentication is established before storage operations
    await this.ensureAuthentication()

    // Check storage availability
    const isStorageAvailable = await this.checkStorageAvailability()
    if (!isStorageAvailable) {
      throw new Error('Storage service is not available. Please check your connection and try again.')
    }

    // Validate and potentially compress file for mobile
    let processedFile = file
    if (this.shouldCompressForMobile(file)) {
      console.log('Compressing file for mobile upload...')
      processedFile = await this.compressForMobile(file)
    }

    if (!this.validateImageFile(processedFile)) {
      throw new Error('Invalid image file. Please upload a valid image (JPEG, PNG, GIF, WebP) under 10MB.')
    }

    // Generate unique filename with datetime-based structure: {projectName}/{imageType}/{dateTime}/{timestamp}_{sanitizedFileName}
    const timestamp = Date.now()
    const sanitizedFileName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9-]/g, '_')
    const dateTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1) // YYYY-MM-DDTHH-MM-SS format
    const fileName = `${sanitizedProjectName}/${imageType}/${dateTime}/${timestamp}_${sanitizedFileName}`

    console.log('Uploading to path:', fileName, 'Size:', processedFile.size, 'Type:', processedFile.type)

    // Create storage reference
    const storageRef = ref(storage, fileName)

    try {
      // Upload with progress tracking using uploadBytesResumable
      const uploadTask = uploadBytesResumable(storageRef, processedFile);

      if (onProgress) {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = {
              loaded: snapshot.bytesTransferred,
              total: snapshot.totalBytes,
              percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            }
            onProgress(progress)
          },
          (error) => {
            console.error('Upload error:', error)
            if (error.code === 'storage/retry-limit-exceeded' && retryCount < MAX_RETRIES) {
              console.log(`Retrying upload (${retryCount + 1}/${MAX_RETRIES})...`)
              // Retry with exponential backoff
              setTimeout(() => {
                this.uploadImageInternal(processedFile, projectName, id, imageType, onProgress, retryCount + 1)
              }, Math.pow(2, retryCount) * 1000)
            } else {
              throw new Error('Failed to upload image. Please try again.')
            }
          }
        )
      }

      // Wait for upload to complete with timeout
      const snapshot = await Promise.race([
        uploadTask,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), 60000)
        )
      ]) as any

      // Get download URL for authenticated users
      const downloadURL = await getDownloadURL(snapshot.ref)

      console.log('Upload successful:', downloadURL)

      return {
        url: downloadURL,
        fileName: processedFile.name,
        size: processedFile.size,
        mimeType: processedFile.type
      }
    } catch (error: any) {
      console.error('Error uploading image:', error)

      // Handle specific Firebase errors
      if (error.code === 'storage/retry-limit-exceeded' && retryCount < MAX_RETRIES) {
        console.log(`Retrying upload due to retry limit exceeded (${retryCount + 1}/${MAX_RETRIES})...`)
        // Wait a bit longer for retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 2000))
        return this.uploadImageInternal(processedFile, projectName, id, imageType, onProgress, retryCount + 1)
      }

      if (error.message?.includes('timeout') || error.message?.includes('Upload timeout')) {
        if (retryCount < MAX_RETRIES) {
          console.log('Upload timed out, retrying with smaller file...')
          const compressedFile = await this.compressForMobile(processedFile)
          return this.uploadImageInternal(compressedFile, projectName, id, imageType, onProgress, retryCount + 1)
        } else {
          throw new Error('Upload timed out. Please try again with a smaller image or check your connection.')
        }
      }

      // Use enhanced error handling
      const friendlyMessage = getUserFriendlyErrorMessage(error)
      throw new ImageUploadError(friendlyMessage, error.code, error)
    }
  }

  /**
   * Upload multiple item images
   */
  static async uploadMultipleItemImages(
    files: File[],
    projectName: string,
    itemId: string,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<ImageUploadResult[]> {
    const results: ImageUploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const result = await this.uploadItemImage(file, projectName, itemId, onProgress ? (progress) => onProgress(i, progress) : undefined)
        results.push(result)
      } catch (error) {
        console.error(`Error uploading image ${i + 1}:`, error)
        throw error // Re-throw to stop the upload process
      }
    }

    return results
  }

  /**
   * Upload multiple transaction images (legacy method for backward compatibility)
   */
  static async uploadMultipleTransactionImages(
    files: File[],
    projectName: string,
    transactionId: string,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<ImageUploadResult[]> {
    const results: ImageUploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const result = await this.uploadTransactionImage(file, projectName, transactionId, onProgress ? (progress) => onProgress(i, progress) : undefined)
        results.push(result)
      } catch (error) {
        console.error(`Error uploading image ${i + 1}:`, error)
        throw error // Re-throw to stop the upload process
      }
    }

    return results
  }

  /**
   * Upload multiple receipt images
   */
  static async uploadMultipleReceiptImages(
    files: File[],
    projectName: string,
    transactionId: string,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<ImageUploadResult[]> {
    const results: ImageUploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const result = await this.uploadReceiptImage(file, projectName, transactionId, onProgress ? (progress) => onProgress(i, progress) : undefined)
        results.push(result)
      } catch (error) {
        console.error(`Error uploading receipt image ${i + 1}:`, error)
        throw error // Re-throw to stop the upload process
      }
    }

    return results
  }

  /**
   * Upload multiple other images
   */
  static async uploadMultipleOtherImages(
    files: File[],
    projectName: string,
    transactionId: string,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<ImageUploadResult[]> {
    const results: ImageUploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const result = await this.uploadOtherImage(file, projectName, transactionId, onProgress ? (progress) => onProgress(i, progress) : undefined)
        results.push(result)
      } catch (error) {
        console.error(`Error uploading other image ${i + 1}:`, error)
        throw error // Re-throw to stop the upload process
      }
    }

    return results
  }

  /**
   * Delete an image from Firebase Storage
   */
  static async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Ensure authentication is established before storage operations
      await this.ensureAuthentication()

      const imageRef = ref(storage, imageUrl)
      await deleteObject(imageRef)
    } catch (error) {
      console.error('Error deleting image:', error)
      throw new Error('Failed to delete image')
    }
  }

  /**
   * Delete multiple images
   */
  static async deleteMultipleImages(imageUrls: string[]): Promise<void> {
    const deletePromises = imageUrls.map(url => this.deleteImage(url))
    await Promise.all(deletePromises)
  }

  /**
   * Convert File objects to TransactionImage objects (legacy method for backward compatibility)
   */
  static convertFilesToTransactionImages(uploadResults: ImageUploadResult[]): TransactionImage[] {
    return uploadResults.map(result => ({
      url: result.url,
      fileName: result.fileName,
      uploadedAt: new Date(),
      size: result.size,
      mimeType: result.mimeType
    }))
  }

  /**
   * Convert File objects to receipt TransactionImage objects
   */
  static convertFilesToReceiptImages(uploadResults: ImageUploadResult[]): TransactionImage[] {
    return uploadResults.map(result => ({
      url: result.url,
      fileName: result.fileName,
      uploadedAt: new Date(),
      size: result.size,
      mimeType: result.mimeType
    }))
  }

  /**
   * Convert File objects to other TransactionImage objects
   */
  static convertFilesToOtherImages(uploadResults: ImageUploadResult[]): TransactionImage[] {
    return uploadResults.map(result => ({
      url: result.url,
      fileName: result.fileName,
      uploadedAt: new Date(),
      size: result.size,
      mimeType: result.mimeType
    }))
  }

  /**
   * Validate image file
   */
  static validateImageFile(file: File): boolean {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return false
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return false
    }

    return true
  }

  /**
   * Get image metadata
   */
  static async getImageMetadata(imageUrl: string): Promise<any> {
    try {
      // Ensure authentication is established before storage operations
      await this.ensureAuthentication()

      const imageRef = ref(storage, imageUrl)
      return await getMetadata(imageRef)
    } catch (error) {
      console.error('Error getting image metadata:', error)
      return null
    }
  }

  /**
   * Compress image for preview (client-side)
   */
  static compressImage(file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          'image/jpeg',
          quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Take photo using device camera
   */
  static takePhoto(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment' // Use back camera on mobile

      input.onchange = (e) => {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0] || null
        resolve(file)
      }

      input.click()
    })
  }

  /**
   * Select images from device gallery/camera roll
   */
  static selectFromGallery(): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.multiple = true
      // Note: capture attribute not set to allow gallery selection

      // Set up timeout to prevent infinite hanging
      const timeoutId = setTimeout(() => {
        // Clean up the input element
        if (document.body.contains(input)) {
          document.body.removeChild(input)
        }
        reject(new Error('File selection timeout - user may have canceled'))
      }, 10000) // 10 second timeout

      // Handle successful file selection
      const handleChange = (e: Event) => {
        clearTimeout(timeoutId) // Clear timeout on success
        if (document.body.contains(input)) {
          document.body.removeChild(input) // Clean up
        }

        const target = e.target as HTMLInputElement
        const files = target.files ? Array.from(target.files) : []
        resolve(files)
      }

      // Handle cleanup if component unmounts during selection
      const handleCancel = () => {
        clearTimeout(timeoutId)
        if (document.body.contains(input)) {
          document.body.removeChild(input)
        }
        reject(new Error('File selection canceled'))
      }

      // Set up event listeners
      input.onchange = handleChange
      input.addEventListener('cancel', handleCancel)

      // Add to DOM temporarily for proper event handling
      document.body.appendChild(input)
      input.click()
    })
  }

  /**
   * Create a preview URL for a file
   */
  static createPreviewUrl(file: File): string {
    return URL.createObjectURL(file)
  }

  /**
   * Clean up preview URL to prevent memory leaks
   */
  static revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url)
  }

  /**
   * Check if file should be compressed for mobile upload
   */
  private static shouldCompressForMobile(file: File): boolean {
    // Check if we're on a mobile device and file is large
    const userAgent = navigator.userAgent.toLowerCase()
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent)
    const isLargeFile = file.size > 2 * 1024 * 1024 // 2MB threshold
    const isMediumFile = file.size > 1024 * 1024 // 1MB threshold

    // Compress for mobile devices with large files, or tablets with very large files
    return (isMobile && isMediumFile) || (isTablet && isLargeFile)
  }

  /**
   * Compress file for mobile upload
   */
  private static async compressForMobile(file: File): Promise<File> {
    try {
      console.log(`Compressing file: ${file.name}, Size: ${file.size} bytes`)

      // Use aggressive compression for mobile
      const compressedFile = await this.compressImage(file, 1200, 0.7)

      console.log(`Compressed to: ${compressedFile.size} bytes (${Math.round((compressedFile.size / file.size) * 100)}% of original)`)

      return compressedFile
    } catch (error) {
      console.warn('Failed to compress file, using original:', error)
      return file // Return original file if compression fails
    }
  }
}
