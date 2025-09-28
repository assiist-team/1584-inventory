import React, { createContext, useContext, useState, useCallback } from 'react'
import ToastItem, { Toast } from './Toast'

interface ToastContextType {
  showToast: (message: string, type: Toast['type'], duration?: number) => string
  showSuccess: (message: string, duration?: number) => string
  showError: (message: string, duration?: number) => string
  showWarning: (message: string, duration?: number) => string
  showInfo: (message: string, duration?: number) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const showToast = useCallback((message: string, type: Toast['type'], duration?: number): string => {
    const id = generateId()
    const toast: Toast = { id, message, type, duration }

    setToasts(prev => [...prev, toast])

    // Auto-remove toast after animation
    setTimeout(() => {
      removeToast(id)
    }, (duration || (type === 'error' ? 6000 : 4000)) + 300)

    return id
  }, [])

  const showSuccess = useCallback((message: string, duration?: number) => {
    return showToast(message, 'success', duration)
  }, [showToast])

  const showError = useCallback((message: string, duration?: number) => {
    return showToast(message, 'error', duration)
  }, [showToast])

  const showWarning = useCallback((message: string, duration?: number) => {
    return showToast(message, 'warning', duration)
  }, [showToast])

  const showInfo = useCallback((message: string, duration?: number) => {
    return showToast(message, 'info', duration)
  }, [showToast])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const value: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 min-w-96 max-w-sm">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
