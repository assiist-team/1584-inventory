import type { DateValue } from '@/types'

/**
 * Safely converts various date representations to JavaScript Date objects
 */
export const toDate = (value: DateValue): Date | null => {
  if (!value) return null

  if (value instanceof Date) {
    return value
  }

  // Handle Firestore Timestamp objects
  if (typeof value === 'object' && value) {
    // Check if it's a Firestore Timestamp with toDate method
    if ('toDate' in value && typeof (value as any).toDate === 'function') {
      try {
        return (value as any).toDate()
      } catch (error) {
        console.warn('Failed to convert Firestore Timestamp to Date:', error)
        return null
      }
    }

    // Check if it's a Firestore Timestamp with seconds/nanoseconds
    if ('seconds' in value && 'nanoseconds' in value) {
      try {
        return new Date((value as any).seconds * 1000 + (value as any).nanoseconds / 1000000)
      } catch (error) {
        console.warn('Failed to convert Firestore Timestamp to Date:', error)
        return null
      }
    }
  }

  // Handle string dates
  if (typeof value === 'string') {
    try {
      // Check if it's a date-only string (YYYY-MM-DD format)
      // This avoids timezone conversion issues by parsing as local time
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        // Parse as local date to avoid timezone conversion
        const [year, month, day] = value.split('-').map(Number)
        const date = new Date(year, month - 1, day) // month is 0-indexed
        return isNaN(date.getTime()) ? null : date
      }

      // For other date formats, use the original parsing
      const date = new Date(value)
      return isNaN(date.getTime()) ? null : date
    } catch (error) {
      console.warn('Failed to parse date string:', value, error)
      return null
    }
  }

  // Handle number (milliseconds since epoch)
  if (typeof value === 'number') {
    try {
      const date = new Date(value)
      return isNaN(date.getTime()) ? null : date
    } catch (error) {
      console.warn('Failed to convert number to Date:', value, error)
      return null
    }
  }

  return null
}

/**
 * Safely formats a date value to a localized string
 */
export const formatDate = (value: DateValue, fallback: string = 'Unknown'): string => {
  const date = toDate(value)
  if (!date) return fallback

  try {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    console.warn('Failed to format date:', value, error)
    return fallback
  }
}

/**
 * Safely formats a date value with specific options
 */
export const formatDateTime = (value: DateValue, options?: Intl.DateTimeFormatOptions, fallback: string = 'Unknown'): string => {
  const date = toDate(value)
  if (!date) return fallback

  try {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }

    const mergedOptions = { ...defaultOptions, ...options }
    return date.toLocaleDateString('en-US', mergedOptions)
  } catch (error) {
    console.warn('Failed to format date:', value, error)
    return fallback
  }
}

/**
 * Safely formats a date value as a time string
 */
export const formatTime = (value: DateValue, fallback: string = 'Unknown'): string => {
  const date = toDate(value)
  if (!date) return fallback

  try {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.warn('Failed to format time:', value, error)
    return fallback
  }
}

/**
 * Checks if a date value is valid
 */
export const isValidDate = (value: DateValue): boolean => {
  return toDate(value) !== null
}

/**
 * Formats a currency amount with proper thousands separators and decimal places
 */
export const formatCurrency = (amount: string | number, fallback: string = '$0.00'): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return fallback

  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Formats a number with thousands separators (no currency symbol)
 */
export const formatNumber = (num: string | number, fallback: string = '0.00'): string => {
  const value = typeof num === 'string' ? parseFloat(num) : num

  if (isNaN(value)) return fallback

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

