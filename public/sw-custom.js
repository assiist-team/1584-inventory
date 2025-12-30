// Custom service worker with offline functionality
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

// Skip waiting and claim clients immediately
workbox.core.skipWaiting()
workbox.core.clientsClaim()

// Precache static assets
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST)

// Runtime caching for Supabase storage (images, etc.)
workbox.routing.registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
  new workbox.strategies.CacheFirst({
    cacheName: 'supabase-storage-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 // 24 hours
      })
    ]
  })
)

// Background Sync for offline operations
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag)

  if (event.tag === 'sync-operations') {
    event.waitUntil(processOperationQueue())
  }
})

// Function to process the operation queue
async function processOperationQueue() {
  console.log('Processing operation queue in background sync')

  try {
    // Import the operation queue functionality
    // Note: This is a simplified version. In a real implementation,
    // you'd need to ensure all dependencies are available in the service worker context

    // For now, just log that background sync was triggered
    console.log('Background sync completed (placeholder implementation)')

    // In the full implementation, this would:
    // 1. Open IndexedDB connection
    // 2. Get pending operations
    // 3. Process each operation
    // 4. Update sync status

  } catch (error) {
    console.error('Background sync failed:', error)
    throw error // Re-throw to mark sync as failed
  }
}

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'SYNC_COMPLETE') {
    // Notify clients that sync is complete
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          timestamp: Date.now()
        })
      })
    })
  }
})

// Periodic cleanup of expired cache entries
self.addEventListener('activate', event => {
  event.waitUntil(
    // Clean up old caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('workbox-') && !cacheName.includes('supabase-storage-cache')) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})