import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from './test-utils'

// Mock Supabase before importing services
const mockSupabase = createMockSupabaseClient()
vi.mock('../supabase', () => ({
  supabase: mockSupabase
}))

// Mock databaseService
vi.mock('../databaseService', () => ({
  ensureAuthenticatedForDatabase: vi.fn().mockResolvedValue(undefined)
}))

// Import after mocks are set up
import { ImageUploadService } from '../imageService'
import * as supabaseModule from '../supabase'

describe('ImageUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkStorageAvailability', () => {
    it('should return true when Supabase is initialized', async () => {
      const isAvailable = await ImageUploadService.checkStorageAvailability()
      expect(isAvailable).toBe(true)
    })
  })

  describe('validateImageFile', () => {
    it('should accept valid image files', () => {
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      expect(ImageUploadService.validateImageFile(validFile)).toBe(true)
    })

    it('should reject invalid file types', () => {
      const invalidFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      expect(ImageUploadService.validateImageFile(invalidFile)).toBe(false)
    })

    it('should reject files larger than 10MB', () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      expect(ImageUploadService.validateImageFile(largeFile)).toBe(false)
    })

    it('should accept files under 10MB', () => {
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(validFile, 'size', { value: 5 * 1024 * 1024 }) // 5MB
      expect(ImageUploadService.validateImageFile(validFile)).toBe(true)
    })

    it('should accept various image formats', () => {
      const formats = [
        { type: 'image/jpeg', name: 'test.jpg' },
        { type: 'image/png', name: 'test.png' },
        { type: 'image/gif', name: 'test.gif' },
        { type: 'image/webp', name: 'test.webp' }
      ]

      formats.forEach(({ type, name }) => {
        const file = new File(['test'], name, { type })
        expect(ImageUploadService.validateImageFile(file)).toBe(true)
      })
    })
  })

  describe('uploadItemImage', () => {
    it('should upload item image successfully', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const mockStorage = createMockSupabaseClient().storage
      
      vi.mocked(supabaseModule.supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } })
      } as any)

      const result = await ImageUploadService.uploadItemImage(file, 'Test Project', 'item-id')
      expect(result.url).toBe('https://example.com/test.jpg')
      expect(result.fileName).toContain('test-path')
    })

    it('should call progress callback', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const progressCallback = vi.fn()
      
      vi.mocked(supabaseModule.supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } })
      } as any)

      await ImageUploadService.uploadItemImage(file, 'Test Project', 'item-id', progressCallback)
      expect(progressCallback).toHaveBeenCalled()
    })
  })

  describe('uploadBusinessLogo', () => {
    it('should upload business logo successfully', async () => {
      const file = new File(['test'], 'logo.jpg', { type: 'image/jpeg' })
      
      vi.mocked(supabaseModule.supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'accounts/test-account/business_profile/logo/logo.jpg' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/logo.jpg' } })
      } as any)

      const result = await ImageUploadService.uploadBusinessLogo('test-account-id', file)
      expect(result.url).toBe('https://example.com/logo.jpg')
      expect(result.fileName).toContain('business_profile/logo')
    })
  })

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      vi.mocked(supabaseModule.supabase.storage.from).mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any)

      await expect(
        ImageUploadService.deleteImage('item-images', 'test-path.jpg')
      ).resolves.not.toThrow()
    })

    it('should throw error on delete failure', async () => {
      const error = { message: 'Delete failed', statusCode: 500 }
      vi.mocked(supabaseModule.supabase.storage.from).mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: null, error })
      } as any)

      await expect(
        ImageUploadService.deleteImage('item-images', 'test-path.jpg')
      ).rejects.toThrow()
    })
  })

  describe('deleteMultipleImages', () => {
    it('should delete multiple images', async () => {
      vi.mocked(supabaseModule.supabase.storage.from).mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any)

      const images = [
        { bucket: 'item-images', fileName: 'path1.jpg' },
        { bucket: 'item-images', fileName: 'path2.jpg' }
      ]

      await expect(
        ImageUploadService.deleteMultipleImages(images)
      ).resolves.not.toThrow()
    })
  })

  describe('convertFilesToTransactionImages', () => {
    it('should convert upload results to TransactionImage objects', () => {
      const uploadResults = [
        {
          url: 'https://example.com/image1.jpg',
          fileName: 'image1.jpg',
          size: 1024,
          mimeType: 'image/jpeg'
        },
        {
          url: 'https://example.com/image2.jpg',
          fileName: 'image2.jpg',
          size: 2048,
          mimeType: 'image/png'
        }
      ]

      const transactionImages = ImageUploadService.convertFilesToTransactionImages(uploadResults)
      expect(transactionImages).toHaveLength(2)
      expect(transactionImages[0].url).toBe('https://example.com/image1.jpg')
      expect(transactionImages[0].fileName).toBe('image1.jpg')
      expect(transactionImages[0].size).toBe(1024)
      expect(transactionImages[0].uploadedAt).toBeInstanceOf(Date)
    })
  })

  describe('createPreviewUrl and revokePreviewUrl', () => {
    it('should create and revoke preview URL', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const url = ImageUploadService.createPreviewUrl(file)
      
      expect(url).toBeTruthy()
      expect(typeof url).toBe('string')
      
      // Should not throw
      expect(() => ImageUploadService.revokePreviewUrl(url)).not.toThrow()
    })
  })
})

