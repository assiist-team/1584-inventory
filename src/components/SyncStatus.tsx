import { useState, useEffect } from 'react'
import { operationQueue } from '../services/operationQueue'
import { onSyncComplete, triggerManualSync } from '../services/serviceWorker'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export function SyncStatus() {
  const [queueLength, setQueueLength] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)

  useEffect(() => {
    const updateStatus = () => {
      setQueueLength(operationQueue.getQueueLength())
    }

    // Update immediately
    updateStatus()

    // Check periodically for queue status
    const interval = setInterval(updateStatus, 2000)

    // Listen for sync complete messages from service worker
    const cleanup = onSyncComplete(() => {
      setIsSyncing(false)
      setLastSyncError(null)
      updateStatus()
    })

    return () => {
      clearInterval(interval)
      cleanup()
    }
  }, [])

  const handleManualSync = async () => {
    setIsSyncing(true)
    setLastSyncError(null)

    try {
      await triggerManualSync()
      // Also trigger foreground processing as backup
      await operationQueue.processQueue()
      setIsSyncing(false)
    } catch (error) {
      setIsSyncing(false)
      setLastSyncError('Manual sync failed')
    }
  }

  if (queueLength === 0 && !isSyncing && !lastSyncError) {
    return null // Nothing to show
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
        lastSyncError
          ? 'bg-red-50 text-red-800 border border-red-200'
          : isSyncing
          ? 'bg-blue-50 text-blue-800 border border-blue-200'
          : queueLength > 0
          ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
          : 'bg-green-50 text-green-800 border border-green-200'
      }`}>
        <div className="flex items-center gap-2">
          {lastSyncError ? (
            <AlertCircle className="w-4 h-4" />
          ) : isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : queueLength > 0 ? (
            <RefreshCw className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}

          <span>
            {lastSyncError
              ? `Sync error: ${lastSyncError}`
              : isSyncing
              ? 'Syncing changes...'
              : queueLength > 0
              ? `${queueLength} change${queueLength === 1 ? '' : 's'} pending`
              : 'All changes synced'
            }
          </span>

          {queueLength > 0 && !isSyncing && (
            <button
              onClick={handleManualSync}
              className="ml-2 px-2 py-1 text-xs bg-white rounded border hover:bg-gray-50"
            >
              Sync now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}