import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, X, AlertCircle, Info } from 'lucide-react'
import { clsx } from 'clsx'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
}

const colorMap = {
  success: {
    container: 'bg-green-50 border-green-200',
    icon: 'text-green-400',
    text: 'text-green-800',
    button: 'text-green-400 hover:bg-green-100',
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-400',
    text: 'text-red-800',
    button: 'text-red-400 hover:bg-red-100',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-400',
    text: 'text-yellow-800',
    button: 'text-yellow-400 hover:bg-yellow-100',
  },
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-400',
    text: 'text-blue-800',
    button: 'text-blue-400 hover:bg-blue-100',
  },
}

function ToastItem({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const Icon = iconMap[toast.type]
  const colors = colorMap[toast.type]

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true)

    // Auto-close after duration
    const duration = toast.duration || (toast.type === 'error' ? 6000 : 4000)
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.duration, toast.type])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose(toast.id)
    }, 300) // Match transition duration
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-between p-4 mb-3 border rounded-lg shadow-sm transition-all duration-300 transform',
        colors.container,
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : '-translate-x-full opacity-0'
      )}
    >
      <div className="flex items-center">
        <Icon className={clsx('h-5 w-5 mr-3 flex-shrink-0', colors.icon)} />
        <p className={clsx('text-sm font-medium', colors.text)}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={handleClose}
        className={clsx(
          'ml-4 inline-flex rounded-md p-1.5 transition-colors duration-200',
          colors.button
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default ToastItem
