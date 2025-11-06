import { PostgrestError } from '@supabase/supabase-js'

/**
 * Core database utilities for Supabase operations.
 * 
 * This module provides utility functions for working with Supabase/Postgres,
 * including timestamp conversion and error handling. Services should use
 * Supabase's native query builder directly (supabase.from(table).select()...)
 * rather than abstracted wrapper methods.
 * 
 * Key principles:
 * - Let Postgres handle timestamps via DEFAULT NOW() in schema
 * - RLS policies handle authentication/authorization automatically
 * - Use SQL joins, aggregations, and Postgres features directly
 * - Convert Postgres ISO timestamp strings to Date objects for app use
 */

/**
 * Converts Postgres timestamps to JavaScript Date objects.
 * Postgres returns timestamps as ISO strings; this converts them to Date objects.
 * Handles various timestamp formats including ISO strings, date-only strings,
 * and numeric timestamps.
 */
export const timestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Date) {
    return timestamp
  }
  if (typeof timestamp === 'string') {
    // Handle date-only strings (YYYY-MM-DD) by creating date at midnight local time
    const dateStr = timestamp.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    return new Date(timestamp)
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp)
  }
  if (!timestamp) {
    return new Date()
  }
  try {
    return new Date(timestamp)
  } catch (error) {
    console.warn('Failed to convert timestamp to date:', timestamp, error)
    return new Date()
  }
}

/**
 * Recursively converts Postgres timestamp fields to JavaScript Date objects.
 * Processes known timestamp fields in objects and arrays.
 * Use this after fetching data from Supabase to convert ISO strings to Date objects.
 */
export const convertTimestamps = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data
  }

  const converted: any = { ...data }

  // Convert known timestamp fields
  const timestampFields = [
    'created_at', 'updated_at', 'last_activity', 'uploaded_at', 
    'generated_at', 'last_scanned', 'last_login', 'joined_at',
    'accepted_at', 'expires_at', 'timestamp'
  ]

  const convertObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    const result: any = { ...obj }

    // Handle arrays of objects FIRST
    if (Array.isArray(result)) {
      return result.map((item: any) => convertObject(item))
    }

    // Convert timestamp fields
    timestampFields.forEach(field => {
      if (result[field]) {
        result[field] = timestampToDate(result[field])
      }
    })

    // Handle nested objects and arrays
    Object.keys(result).forEach(key => {
      if (result[key] && typeof result[key] === 'object') {
        if (Array.isArray(result[key])) {
          result[key] = result[key].map((item: any) => convertObject(item))
        } else {
          result[key] = convertObject(result[key])
        }
      }
    })

    return result
  }

  return convertObject(converted)
}

/**
 * Checks if a Supabase error is a "not found" error (PGRST116).
 * Useful for handling cases where a record doesn't exist.
 */
export const isNotFoundError = (error: PostgrestError | null): boolean => {
  return error?.code === 'PGRST116'
}

/**
 * Checks if a Supabase error is a foreign key violation.
 * Useful for handling constraint violations.
 */
export const isForeignKeyError = (error: PostgrestError | null): boolean => {
  return error?.code === '23503'
}

/**
 * Checks if a Supabase error is a unique constraint violation.
 * Useful for handling duplicate key errors.
 */
export const isUniqueConstraintError = (error: PostgrestError | null): boolean => {
  return error?.code === '23505'
}

/**
 * Checks if a Supabase error is a permission/RLS policy violation.
 * Useful for handling authorization errors.
 */
export const isPermissionError = (error: PostgrestError | null): boolean => {
  return error?.code === '42501' || error?.code === 'PGRST301'
}

/**
 * Handles Supabase Postgres errors with flexible error handling.
 * 
 * @param error - The Supabase error to handle
 * @param options - Options for error handling
 * @param options.throwOnError - If true, throws an error (default: true)
 * @param options.returnNullOnNotFound - If true, returns null for not found errors instead of throwing
 * @returns null if returnNullOnNotFound is true and error is not found, otherwise throws or returns void
 */
export const handleSupabaseError = (
  error: PostgrestError | null,
  options: {
    throwOnError?: boolean
    returnNullOnNotFound?: boolean
  } = {}
): void | null => {
  if (!error) {
    return null
  }

  const { throwOnError = true, returnNullOnNotFound = false } = options

  // Handle not found errors specially if requested
  if (returnNullOnNotFound && isNotFoundError(error)) {
    return null
  }

  // Log error for debugging
  console.error('Supabase error:', {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  })

  if (throwOnError) {
    // Provide more context in error message
    let errorMessage = error.message || 'Database error occurred'
    
    if (isPermissionError(error)) {
      errorMessage = 'Permission denied. You may not have access to this resource.'
    } else if (isForeignKeyError(error)) {
      errorMessage = 'Cannot perform this operation due to related records.'
    } else if (isUniqueConstraintError(error)) {
      errorMessage = 'A record with this information already exists.'
    }
    
    throw new Error(errorMessage)
  }

  return null
}

