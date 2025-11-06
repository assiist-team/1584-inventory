# Task 4.1: Image Upload Service Migration

## Objective
Migrate the image upload service from Firebase Storage to Supabase Storage.

## Steps

### 1. Update `src/services/imageService.ts`

Replace Firebase Storage imports and functions:

```typescript
import { supabase } from './supabase'
import { ensureAuthenticatedForDatabase } from './databaseService'
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
   * Check if Supabase Storage is available
   */
  static async checkStorageAvailability(): Promise<boolean> {
    try {
      if (!supabase) {
        console.error('Supabase not initialized')
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
      await ensureAuthenticatedForDatabase()
    } catch (error) {
      console.error('Failed to ensure authentication:', error)
      throw new Error('Authentication required for storage operations. Please refresh the page and try again.')
    }
  }

  /**
   * Upload an item image to Supabase Storage
   */
  static async uploadItemImage(
    file: File,
    projectName: string,
    itemId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, itemId, 'item-images', onProgress, retryCount)
  }

  /**
   * Upload a transaction image to Supabase Storage
   */
  static async uploadTransactionImage(
    file: File,
    projectName: string,
    transactionId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, transactionId, 'transaction-images', onProgress, retryCount)
  }

  /**
   * Upload a receipt image to Supabase Storage
   */
  static async uploadReceiptImage(
    file: File,
    projectName: string,
    transactionId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, transactionId, 'receipt-images', onProgress, retryCount)
  }

  /**
   * Upload an other image to Supabase Storage
   */
  static async uploadOtherImage(
    file: File,
    projectName: string,
    transactionId: string,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    return this.uploadImageInternal(file, projectName, transactionId, 'other-images', onProgress, retryCount)
  }

  /**
   * Upload business logo to Supabase Storage
   */
  static async uploadBusinessLogo(
    accountId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    const MAX_RETRIES = 3

    console.log(`Upload attempt ${retryCount + 1}/${MAX_RETRIES + 1}`)

    await this.ensureAuthentication()

    const isStorageAvailable = await this.checkStorageAvailability()
    if (!isStorageAvailable) {
      throw new Error('Storage service is not available. Please check your connection and try again.')
    }

    let processedFile = file
    if (this.shouldCompressForMobile(file)) {
      console.log('Compressing file for mobile upload...')
      processedFile = await this.compressForMobile(file)
    }

    if (!this.validateImageFile(processedFile)) {
      throw new Error('Invalid image file. Please upload a valid image (JPEG, PNG, GIF, WebP) under 10MB.')
    }

    const timestamp = Date.now()
    const sanitizedFileName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `accounts/${accountId}/business_profile/logo/${timestamp}_${sanitizedFileName}`

    console.log('Uploading to path:', fileName, 'Size:', processedFile.size, 'Type:', processedFile.type)

    try {
      const { data, error } = await supabase.storage
        .from('business-logos')
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('business-logos')
        .getPublicUrl(fileName)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file')
      }

      return {
        url: urlData.publicUrl,
        fileName: fileName,
        size: processedFile.size,
        mimeType: processedFile.type
      }
    } catch (error: any) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying upload (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.uploadBusinessLogo(accountId, file, onProgress, retryCount + 1)
      }

      const friendlyMessage = getUserFriendlyErrorMessage(error)
      throw new ImageUploadError(friendlyMessage, error.code, error)
    }
  }

  /**
   * Internal upload method
   */
  private static async uploadImageInternal(
    file: File,
    projectName: string,
    id: string,
    imageType: 'item-images' | 'transaction-images' | 'receipt-images' | 'other-images',
    onProgress?: (progress: UploadProgress) => void,
    retryCount: number = 0
  ): Promise<ImageUploadResult> {
    const MAX_RETRIES = 3

    console.log(`Upload attempt ${retryCount + 1}/${MAX_RETRIES + 1}`)

    await this.ensureAuthentication()

    const isStorageAvailable = await this.checkStorageAvailability()
    if (!isStorageAvailable) {
      throw new Error('Storage service is not available. Please check your connection and try again.')
    }

    let processedFile = file
    if (this.shouldCompressForMobile(file)) {
      console.log('Compressing file for mobile upload...')
      processedFile = await this.compressForMobile(file)
    }

    if (!this.validateImageFile(processedFile)) {
      throw new Error('Invalid image file. Please upload a valid image (JPEG, PNG, GIF, WebP) under 10MB.')
    }

    const timestamp = Date.now()
    const sanitizedFileName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9-]/g, '_')
    const dateTime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1)
    const fileName = `${sanitizedProjectName}/${imageType}/${dateTime}/${timestamp}_${sanitizedFileName}`

    console.log('Uploading to path:', fileName, 'Size:', processedFile.size, 'Type:', processedFile.type)

    try {
      // Supabase doesn't have built-in progress tracking like Firebase
      // We'll simulate it or use a different approach
      const { data, error } = await supabase.storage
        .from(imageType)
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Simulate progress if callback provided
      if (onProgress) {
        onProgress({ loaded: processedFile.size, total: processedFile.size, percentage: 100 })
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(imageType)
        .getPublicUrl(fileName)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file')
      }

      return {
        url: urlData.publicUrl,
        fileName: fileName,
        size: processedFile.size,
        mimeType: processedFile.type
      }
    } catch (error: any) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying upload (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.uploadImageInternal(file, projectName, id, imageType, onProgress, retryCount + 1)
      }

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
    const uploadPromises = files.map(async (file, index) => {
      return this.uploadItemImage(file, projectName, itemId, (progress) => {
        if (onProgress) {
          onProgress(index, progress)
        }
      })
    })

    return Promise.all(uploadPromises)
  }

  /**
   * Delete an image from Supabase Storage
   */
  static async deleteImage(bucket: string, fileName: string): Promise<void> {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName])

    if (error) throw error
  }

  // Keep existing helper methods (validateImageFile, shouldCompressForMobile, compressForMobile)
  // These don't need to change
}
```

## Key Changes

1. **Storage reference**:
   - Firebase: `ref(storage, fileName)`
   - Supabase: `supabase.storage.from(bucket).upload(fileName, file)`

2. **Upload method**:
   - Firebase: `uploadBytesResumable()` with progress tracking
   - Supabase: `upload()` (no built-in progress, may need to implement custom)

3. **Public URL**:
   - Firebase: `getDownloadURL(ref)`
   - Supabase: `getPublicUrl(fileName)`

4. **Delete**:
   - Firebase: `deleteObject(ref)`
   - Supabase: `remove([fileName])`

## Progress Tracking Note

Supabase Storage doesn't have built-in progress tracking like Firebase. Options:
1. Simulate progress (set to 100% on completion)
2. Use a library that wraps fetch with progress
3. Implement custom progress tracking

## Verification
- [ ] Can upload item images
- [ ] Can upload transaction images
- [ ] Can upload receipt images
- [ ] Can upload business logos
- [ ] Can get public URLs
- [ ] Can delete images
- [ ] Error handling works

## Next Steps
- Proceed to Task 5.1: Row Level Security Policies

