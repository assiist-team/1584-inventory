import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import { useNetworkState } from './useNetworkState'
import { offlineStore } from '../services/offlineStore'

interface OfflineAwareQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryFn'> {
  queryKey: any[]
  queryFn: () => Promise<T>
  offlineFallback?: () => Promise<T | null>
  onSuccess?: (data: T) => Promise<void> | void
}

export function useOfflineAwareQuery<T = unknown>({
  queryKey,
  queryFn,
  offlineFallback,
  onSuccess,
  ...options
}: OfflineAwareQueryOptions<T>) {
  const { isOnline } = useNetworkState()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        // Try network request first if online
        if (isOnline) {
          const data = await queryFn()

          // Cache successful network response in IndexedDB
          if (onSuccess) {
            await onSuccess(data)
          }

          return data
        }
      } catch (error) {
        console.warn('Network request failed, falling back to offline data:', error)
      }

      // Fall back to offline data
      if (offlineFallback) {
        const offlineData = await offlineFallback()
        if (offlineData !== null) {
          return offlineData
        }
      }

      // If no offline fallback or it returned null, throw error
      throw new Error('No data available offline')
    },
    ...options,
    // Don't refetch automatically when offline
    refetchOnWindowFocus: isOnline ? options.refetchOnWindowFocus : false,
    refetchOnReconnect: true,
  })
}

// Helper hook for simple offline-aware queries with automatic caching
export function useCachedQuery<T = unknown>(
  queryKey: any[],
  fetchFn: () => Promise<T>,
  cacheKey: string,
  options?: Partial<UseQueryOptions<T>>
) {
  const { isOnline } = useNetworkState()

  return useOfflineAwareQuery({
    queryKey,
    queryFn: fetchFn,
    offlineFallback: async () => {
      try {
        // Try to get from IndexedDB cache
        const cached = await offlineStore.getCachedData(cacheKey)
        return cached as T | null
      } catch {
        return null
      }
    },
    onSuccess: async (data: T) => {
      // Cache successful responses
      try {
        await offlineStore.setCachedData(cacheKey, data)
      } catch (error) {
        console.warn('Failed to cache data:', error)
      }
    },
    staleTime: isOnline ? 5 * 60 * 1000 : Infinity, // 5 minutes when online, never stale when offline
    ...options
  })
}