import { describe, it, expect } from 'vitest'
import {
  timestampToDate,
  convertTimestamps,
  isNotFoundError,
  isForeignKeyError,
  isUniqueConstraintError,
  isPermissionError,
  handleSupabaseError
} from '../databaseService'
import { createNotFoundError, createPermissionError, createForeignKeyError, createUniqueConstraintError } from './test-utils'

describe('databaseService', () => {
  describe('timestampToDate', () => {
    it('should convert ISO string to Date', () => {
      const isoString = '2023-01-15T10:30:00Z'
      const result = timestampToDate(isoString)
      expect(result).toBeInstanceOf(Date)
      // Check that the date is correct (allowing for timezone differences)
      expect(result.getTime()).toBe(new Date(isoString).getTime())
    })

    it('should handle date-only strings (YYYY-MM-DD)', () => {
      const dateString = '2023-01-15'
      const result = timestampToDate(dateString)
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2023)
      expect(result.getMonth()).toBe(0) // January is 0
      expect(result.getDate()).toBe(15)
    })

    it('should return Date object as-is', () => {
      const date = new Date('2023-01-15T10:30:00Z')
      const result = timestampToDate(date)
      expect(result).toBe(date)
    })

    it('should convert numeric timestamp to Date', () => {
      const timestamp = 1673782200000
      const result = timestampToDate(timestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBe(timestamp)
    })

    it('should return current date for null/undefined', () => {
      const result = timestampToDate(null)
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBeGreaterThan(0)
    })

    it('should handle invalid timestamp gracefully', () => {
      const invalid = 'not-a-date'
      const result = timestampToDate(invalid)
      expect(result).toBeInstanceOf(Date)
    })
  })

  describe('convertTimestamps', () => {
    it('should convert timestamp fields in object', () => {
      const data = {
        id: 'test-id',
        created_at: '2023-01-15T10:30:00Z',
        updated_at: '2023-01-16T10:30:00Z',
        name: 'Test'
      }
      const result = convertTimestamps(data)
      // convertTimestamps returns Date objects
      expect(result.created_at).toBeInstanceOf(Date)
      expect(result.updated_at).toBeInstanceOf(Date)
      expect(result.name).toBe('Test')
      expect(result.id).toBe('test-id')
    })

    it('should convert timestamps in array of objects', () => {
      const data = [
        { id: '1', created_at: '2023-01-15T10:30:00Z' },
        { id: '2', created_at: '2023-01-16T10:30:00Z' }
      ]
      const result = convertTimestamps(data)
      // When passed an array, convertTimestamps processes each item
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].created_at).toBeInstanceOf(Date)
      expect(result[1].created_at).toBeInstanceOf(Date)
    })

    it('should handle nested objects', () => {
      const data = {
        id: 'test-id',
        created_at: '2023-01-15T10:30:00Z',
        nested: {
          updated_at: '2023-01-16T10:30:00Z',
          name: 'Nested'
        }
      }
      const result = convertTimestamps(data)
      expect(result.created_at).toBeInstanceOf(Date)
      expect(result.nested.updated_at).toBeInstanceOf(Date)
      expect(result.nested.name).toBe('Nested')
    })

    it('should handle arrays within objects', () => {
      const data = {
        id: 'test-id',
        items: [
          { id: '1', created_at: '2023-01-15T10:30:00Z' },
          { id: '2', created_at: '2023-01-16T10:30:00Z' }
        ]
      }
      const result = convertTimestamps(data)
      expect(result.items[0].created_at).toBeInstanceOf(Date)
      expect(result.items[1].created_at).toBeInstanceOf(Date)
    })

    it('should convert all known timestamp fields', () => {
      const data = {
        created_at: '2023-01-15T10:30:00Z',
        updated_at: '2023-01-16T10:30:00Z',
        last_activity: '2023-01-17T10:30:00Z',
        uploaded_at: '2023-01-18T10:30:00Z',
        generated_at: '2023-01-19T10:30:00Z',
        last_scanned: '2023-01-20T10:30:00Z',
        last_login: '2023-01-21T10:30:00Z',
        joined_at: '2023-01-22T10:30:00Z',
        accepted_at: '2023-01-23T10:30:00Z',
        expires_at: '2023-01-24T10:30:00Z',
        timestamp: '2023-01-25T10:30:00Z'
      }
      const result = convertTimestamps(data)
      Object.keys(result).forEach(key => {
        expect(result[key]).toBeInstanceOf(Date)
      })
    })

    it('should return non-objects as-is', () => {
      expect(convertTimestamps(null)).toBe(null)
      expect(convertTimestamps(undefined)).toBe(undefined)
      expect(convertTimestamps('string')).toBe('string')
      expect(convertTimestamps(123)).toBe(123)
      expect(convertTimestamps(true)).toBe(true)
    })
  })

  describe('isNotFoundError', () => {
    it('should identify PGRST116 as not found error', () => {
      const error = createNotFoundError()
      expect(isNotFoundError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = createPermissionError()
      expect(isNotFoundError(error)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isNotFoundError(null)).toBe(false)
    })
  })

  describe('isForeignKeyError', () => {
    it('should identify 23503 as foreign key error', () => {
      const error = createForeignKeyError()
      expect(isForeignKeyError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = createNotFoundError()
      expect(isForeignKeyError(error)).toBe(false)
    })
  })

  describe('isUniqueConstraintError', () => {
    it('should identify 23505 as unique constraint error', () => {
      const error = createUniqueConstraintError()
      expect(isUniqueConstraintError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = createNotFoundError()
      expect(isUniqueConstraintError(error)).toBe(false)
    })
  })

  describe('isPermissionError', () => {
    it('should identify 42501 as permission error', () => {
      const error = createPermissionError()
      expect(isPermissionError(error)).toBe(true)
    })

    it('should identify PGRST301 as permission error', () => {
      const error = { code: 'PGRST301', message: 'permission denied', details: null, hint: null }
      expect(isPermissionError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = createNotFoundError()
      expect(isPermissionError(error)).toBe(false)
    })
  })

  describe('handleSupabaseError', () => {
    it('should throw error by default', () => {
      const error = createNotFoundError()
      expect(() => handleSupabaseError(error)).toThrow()
    })

    it('should not throw when throwOnError is false', () => {
      const error = createNotFoundError()
      expect(() => handleSupabaseError(error, { throwOnError: false })).not.toThrow()
    })

    it('should return null for not found when returnNullOnNotFound is true', () => {
      const error = createNotFoundError()
      const result = handleSupabaseError(error, { returnNullOnNotFound: true })
      expect(result).toBe(null)
    })

    it('should return null when no error', () => {
      const result = handleSupabaseError(null)
      expect(result).toBe(null)
    })

    it('should provide user-friendly error messages', () => {
      const permissionError = createPermissionError()
      expect(() => handleSupabaseError(permissionError)).toThrow('Permission denied')

      const fkError = createForeignKeyError()
      expect(() => handleSupabaseError(fkError)).toThrow('related records')

      const uniqueError = createUniqueConstraintError()
      expect(() => handleSupabaseError(uniqueError)).toThrow('already exists')
    })
  })
})

