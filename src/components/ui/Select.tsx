import React, { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'

interface SelectProps {
  label?: string
  error?: string
  helperText?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'minimal'
  className?: string
  children: React.ReactNode
  id?: string
  value?: string
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
  disabled?: boolean
}

export function Select({
  label,
  error,
  helperText,
  size = 'md',
  variant = 'default',
  className,
  children,
  id,
  value,
  onChange,
  disabled = false,
}: SelectProps) {
  const [isFocused, setIsFocused] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  // Track when select is focused for styling
  useEffect(() => {
    const handleFocus = () => setIsFocused(true)
    const handleBlur = () => setIsFocused(false)

    const selectElement = selectRef.current
    if (selectElement) {
      selectElement.addEventListener('focus', handleFocus)
      selectElement.addEventListener('blur', handleBlur)

      return () => {
        selectElement.removeEventListener('focus', handleFocus)
        selectElement.removeEventListener('blur', handleBlur)
      }
    }
  }, [])

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const baseClasses = clsx(
    'block w-full border rounded-md shadow-sm transition-colors',
    'bg-white text-gray-900 font-sans',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
    'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
    sizeClasses[size],
    variant === 'minimal' ? 'border-0 bg-transparent shadow-none' : 'border-gray-300',
    className
  )

  const errorClasses = error
    ? 'focus:ring-red-500 focus:border-red-500'
    : ''

  const focusClasses = isFocused && !disabled
    ? (error ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-primary-500 focus:border-primary-500')
    : ''

  const finalClasses = clsx(baseClasses, errorClasses, focusClasses)

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700" style={{ color: '#374151' }}>
          {label}
        </label>
      )}

      <div className="relative">
        <select
          ref={selectRef}
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={clsx(finalClasses, 'appearance-none pr-8 cursor-pointer')}
          style={{
            backgroundColor: disabled ? '#f9fafb' : 'white', // gray-50 for disabled, white for normal
            color: disabled ? '#6b7280' : '#111827', // gray-500 for disabled, gray-900 for normal
            fontFamily: 'Avenir, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            borderColor: error ? '#fca5a5' : variant === 'minimal' ? 'transparent' : '#d1d5db', // gray-300 or red-300 for error
          }}
        >
          {children}
        </select>

        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={clsx(
              'h-4 w-4 text-gray-400 transition-transform',
              isFocused && 'transform rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" style={{ color: '#dc2626' }}>{error}</p>
      )}

      {helperText && !error && (
        <p className="text-sm text-gray-500" style={{ color: '#6b7280' }}>{helperText}</p>
      )}
    </div>
  )
}
