// Service Worker utilities for offline functionality

export const registerBackgroundSync = async (): Promise<void> => {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready

      // Register background sync for operations
      await registration.sync.register('sync-operations')
      console.log('✅ Background sync registered for operations')

    } catch (error) {
      console.warn('❌ Background sync registration failed:', error)
      // This is not critical - foreground sync will still work
    }
  } else {
    console.log('ℹ️ Background Sync not supported, will use foreground sync only')
  }
}

export const unregisterBackgroundSync = async (): Promise<void> => {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready

      // Get all registered sync tags and unregister them
      const tags = await registration.sync.getTags()
      for (const tag of tags) {
        await registration.sync.unregister(tag)
        console.log('✅ Unregistered background sync:', tag)
      }

    } catch (error) {
      console.warn('❌ Background sync unregistration failed:', error)
    }
  }
}

export const triggerManualSync = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready

      // Send message to service worker to trigger sync
      registration.active?.postMessage({
        type: 'TRIGGER_SYNC'
      })

      console.log('📤 Manual sync triggered')
    } catch (error) {
      console.warn('❌ Manual sync trigger failed:', error)
    }
  }
}

export const notifySyncComplete = (): void => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({
      type: 'SYNC_COMPLETE'
    })
  }
}

// Listen for sync completion messages from service worker
export const onSyncComplete = (callback: () => void): (() => void) => {
  const messageHandler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_COMPLETE') {
      callback()
    }
  }

  navigator.serviceWorker.addEventListener('message', messageHandler)

  // Return cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener('message', messageHandler)
  }
}