# API Design Document

## Overview

This document outlines the Firestore query patterns, optimization techniques, error handling strategies, and performance monitoring approach for the 1584 Design system.

## Firestore Query Patterns

### Project Queries

#### Get All Projects
```typescript
// Basic project listing with sorting
const getAllProjects = async () => {
  const projectsRef = collection(db, 'projects');
  const q = query(
    projectsRef,
    orderBy('updatedAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
```

#### Get Projects with Item Counts
```typescript
// Complex query with aggregation
const getProjectsWithStats = async () => {
  const projectsRef = collection(db, 'projects');

  // Get projects
  const projectsSnapshot = await getDocs(
    query(projectsRef, orderBy('updatedAt', 'desc'))
  );

  // Get item counts for each project
  const projectsWithStats = await Promise.all(
    projectsSnapshot.docs.map(async (projectDoc) => {
      const projectData = projectDoc.data();

      // Get item count using aggregation query
      const itemsRef = collection(db, 'projects', projectDoc.id, 'items');
      const itemsSnapshot = await getCountFromServer(itemsRef);

      return {
        id: projectDoc.id,
        ...projectData,
        itemCount: itemsSnapshot.data().count
      };
    })
  );

  return projectsWithStats;
};
```

#### Get Single Project with Items
```typescript
// Get project with nested items
const getProjectWithItems = async (projectId: string) => {
  // Get project document
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }

  // Get items subcollection
  const itemsRef = collection(db, 'projects', projectId, 'items');
  const itemsSnap = await getDocs(
    query(itemsRef, orderBy('updatedAt', 'desc'))
  );

  const items = itemsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return {
    id: projectSnap.id,
    ...projectSnap.data(),
    items
  };
};
```

### Item Queries

#### Get Items with Filtering
```typescript
// Complex filtering with multiple conditions
const getFilteredItems = async (
  projectId: string,
  filters: {
    status?: string;
    category?: string;
    tags?: string[];
    priceRange?: { min: number; max: number };
    searchQuery?: string;
  },
  pagination: { page: number; limit: number }
) => {
  const itemsRef = collection(db, 'projects', projectId, 'items');
  let q = query(itemsRef);

  // Apply filters
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }

  if (filters.category) {
    q = query(q, where('category', '==', filters.category));
  }

  if (filters.tags && filters.tags.length > 0) {
    q = query(q, where('tags', 'array-contains-any', filters.tags));
  }

  if (filters.priceRange) {
    q = query(
      q,
      where('price', '>=', filters.priceRange.min),
      where('price', '<=', filters.priceRange.max)
    );
  }

  // Apply text search (requires composite index)
  if (filters.searchQuery) {
    const searchTerm = filters.searchQuery.toLowerCase();
    q = query(
      q,
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff')
    );
  }

  // Apply sorting and pagination
  q = query(
    q,
    orderBy('updatedAt', 'desc'),
    limit(pagination.limit),
    startAfter(pagination.page * pagination.limit)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
```

#### Real-time Item Listeners
```typescript
// Real-time updates for item lists
const subscribeToItems = (
  projectId: string,
  filters: FilterOptions,
  onUpdate: (items: Item[]) => void
) => {
  const itemsRef = collection(db, 'projects', projectId, 'items');
  let q = query(itemsRef);

  // Apply same filters as above
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }

  q = query(q, orderBy('updatedAt', 'desc'));

  // Set up real-time listener
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    onUpdate(items);
  });

  return unsubscribe;
};
```

#### Item Search with Autocomplete
```typescript
// Search suggestions for autocomplete
const getSearchSuggestions = async (projectId: string, query: string) => {
  if (query.length < 2) return [];

  const itemsRef = collection(db, 'projects', projectId, 'items');
  const q = query(
    itemsRef,
    where('name', '>=', query.toLowerCase()),
    where('name', '<=', query.toLowerCase() + '\uf8ff'),
    orderBy('name'),
    limit(10)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    category: doc.data().category
  }));
};
```

## Performance Optimization Strategies

### Query Optimization

#### Use Composite Indexes
```typescript
// Required indexes for optimal performance
const indexes = [
  {
    collectionGroup: 'items',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'items',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'name', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'items',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'price', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  }
];
```

#### Pagination Strategy
```typescript
// Efficient pagination with cursor-based approach
const getItemsPage = async (
  projectId: string,
  lastItem?: Item,
  pageSize: number = 20
) => {
  const itemsRef = collection(db, 'projects', projectId, 'items');
  let q = query(itemsRef, orderBy('updatedAt', 'desc'));

  if (lastItem) {
    q = query(q, startAfter(lastItem.updatedAt));
  }

  q = query(q, limit(pageSize));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
```

#### Debounced Search
```typescript
// Prevent excessive queries during typing
const debouncedSearch = useCallback(
  debounce(async (query: string) => {
    if (query.length < 2) return;

    const results = await searchItems(projectId, query);
    setSearchResults(results);
  }, 300),
  [projectId]
);
```

### Caching Strategy

#### Firestore Built-in Cache
```typescript
// Enable offline persistence
await enableNetworkPersistence(db);

// Configure cache size
const settings = {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
};
setFirestoreSettings(db, settings);
```

#### React Query for Server State
```typescript
// Cache configuration for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on permission errors
        if (error.code === 'permission-denied') return false;
        return failureCount < 3;
      }
    }
  }
});
```

#### Optimistic Updates
```typescript
// Immediate UI update with rollback capability
const updateItemOptimistically = async (itemId: string, updates: Partial<Item>) => {
  // Cancel any outgoing refetches
  queryClient.cancelQueries(['items', projectId]);

  // Snapshot previous value
  const previousItems = queryClient.getQueryData(['items', projectId]);

  // Optimistically update cache
  queryClient.setQueryData(['items', projectId], (old: Item[] | undefined) => {
    if (!old) return old;
    return old.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
  });

  try {
    // Attempt the actual update
    await updateItemInFirestore(itemId, updates);
  } catch (error) {
    // Rollback on failure
    queryClient.setQueryData(['items', projectId], previousItems);
    throw error;
  }
};
```

## Error Handling Strategies

### Error Types and Classification

#### Network Errors
```typescript
const handleNetworkError = (error: FirestoreError) => {
  switch (error.code) {
    case 'unavailable':
      return {
        type: 'network',
        message: 'Network connection unavailable. Please check your internet connection.',
        retryable: true
      };
    case 'deadline-exceeded':
      return {
        type: 'timeout',
        message: 'Request timed out. Please try again.',
        retryable: true
      };
    default:
      return {
        type: 'network',
        message: 'Network error occurred. Please try again.',
        retryable: true
      };
  }
};
```

#### Permission Errors
```typescript
const handlePermissionError = (error: FirestoreError) => {
  switch (error.code) {
    case 'permission-denied':
      return {
        type: 'permission',
        message: 'You do not have permission to perform this action.',
        retryable: false
      };
    case 'unauthenticated':
      return {
        type: 'auth',
        message: 'Please sign in to continue.',
        retryable: false
      };
    default:
      return {
        type: 'permission',
        message: 'Permission error occurred.',
        retryable: false
      };
  }
};
```

#### Data Validation Errors
```typescript
const handleValidationError = (error: any) => {
  if (error.message?.includes('invalid-argument')) {
    return {
      type: 'validation',
      message: 'Invalid data provided. Please check your input.',
      retryable: false
    };
  }

  return {
    type: 'validation',
    message: 'Data validation error occurred.',
    retryable: false
  };
};
```

### Global Error Handler
```typescript
// Global error boundary for Firestore operations
const handleFirestoreError = (error: any): AppError => {
  // Handle different error types
  if (error.code?.startsWith('permission')) {
    return handlePermissionError(error);
  }

  if (error.code?.startsWith('unavailable') || error.code?.startsWith('deadline')) {
    return handleNetworkError(error);
  }

  if (error.message?.includes('invalid')) {
    return handleValidationError(error);
  }

  // Default error
  return {
    type: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true
  };
};
```

### User Feedback Mechanisms

#### Toast Notifications
```typescript
const showErrorToast = (error: AppError) => {
  const toast = {
    id: generateId(),
    type: 'error',
    title: 'Error',
    description: error.message,
    duration: error.retryable ? 5000 : 10000,
    action: error.retryable ? {
      label: 'Retry',
      onClick: () => retryLastOperation()
    } : undefined
  };

  addToast(toast);
};
```

#### Retry Logic
```typescript
const retryOperation = async (
  operation: () => Promise<any>,
  maxRetries: number = 3,
  delay: number = 1000
) => {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
};

const shouldRetry = (error: any) => {
  const retryableCodes = ['unavailable', 'deadline-exceeded', 'resource-exhausted'];
  return retryableCodes.includes(error.code);
};
```

## Performance Monitoring

### Core Web Vitals Tracking
```typescript
// Track performance metrics
const trackPerformance = () => {
  // Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    trackMetric('LCP', lastEntry.startTime);
  });
  lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

  // First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      trackMetric('FID', entry.processingStart - entry.startTime);
    });
  });
  fidObserver.observe({ entryTypes: ['first-input'] });

  // Cumulative Layout Shift
  const clsObserver = new PerformanceObserver((list) => {
    let clsValue = 0;
    const entries = list.getEntries();

    entries.forEach((entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });

    trackMetric('CLS', clsValue);
  });
  clsObserver.observe({ entryTypes: ['layout-shift'] });
};
```

### Firestore Performance Monitoring
```typescript
// Monitor query performance
const monitorQueryPerformance = async (queryName: string, queryFn: () => Promise<any>) => {
  const startTime = performance.now();

  try {
    const result = await queryFn();
    const duration = performance.now() - startTime;

    // Track successful query
    trackMetric(`firestore.${queryName}.success`, duration);

    // Warn for slow queries
    if (duration > 1000) {
      console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    // Track failed query
    trackMetric(`firestore.${queryName}.error`, duration);

    throw error;
  }
};
```

### Real-time Listener Management
```typescript
// Monitor listener lifecycle
class ListenerManager {
  private listeners = new Map<string, Unsubscribe>();

  addListener(key: string, unsubscribe: Unsubscribe) {
    // Remove existing listener for this key
    this.removeListener(key);

    this.listeners.set(key, unsubscribe);

    // Track listener count
    trackMetric('firestore.listeners.active', this.listeners.size);
  }

  removeListener(key: string) {
    const unsubscribe = this.listeners.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(key);
      trackMetric('firestore.listeners.active', this.listeners.size);
    }
  }

  removeAllListeners() {
    this.listeners.forEach((unsubscribe, key) => {
      unsubscribe();
    });
    this.listeners.clear();
    trackMetric('firestore.listeners.active', 0);
  }
}
```

### Memory Management
```typescript
// Monitor memory usage for real-time listeners
const monitorMemoryUsage = () => {
  const checkMemory = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      trackMetric('memory.used', memory.usedJSHeapSize);
      trackMetric('memory.total', memory.totalJSHeapSize);
      trackMetric('memory.limit', memory.jsHeapSizeLimit);
    }
  };

  // Check memory every 30 seconds
  setInterval(checkMemory, 30000);

  // Initial check
  checkMemory();
};
```

## Data Validation and Sanitization

### Input Validation
```typescript
const validateItemData = (data: any): ItemData => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(1000).optional(),
    category: Joi.string().valid('paper-goods', 'digital', 'physical').required(),
    status: Joi.string().valid('active', 'sold', 'damaged', 'reserved').required(),
    quantity: Joi.number().integer().min(0).max(10000).required(),
    price: Joi.number().min(0).max(100000).precision(2).required(),
    sku: Joi.string().pattern(/^[A-Z]{2}-\d{3}$/).optional(),
    tags: Joi.array().items(Joi.string()).max(10).optional()
  });

  const { error, value } = schema.validate(data);

  if (error) {
    throw new ValidationError(error.message);
  }

  return value;
};
```

### Output Sanitization
```typescript
const sanitizeItemForDisplay = (item: any): SafeItem => {
  return {
    id: item.id,
    name: DOMPurify.sanitize(item.name),
    description: DOMPurify.sanitize(item.description || ''),
    category: item.category,
    status: item.status,
    quantity: item.quantity,
    price: item.price,
    sku: item.sku,
    tags: item.tags?.map((tag: string) => DOMPurify.sanitize(tag)) || [],
    images: item.images?.map((image: any) => ({
      url: sanitizeUrl(image.url),
      alt: DOMPurify.sanitize(image.alt || '')
    })) || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
};
```

This API design provides a robust foundation for efficient, scalable, and maintainable data operations with comprehensive error handling, performance monitoring, and data validation.
