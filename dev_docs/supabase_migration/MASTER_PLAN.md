# Firebase to Supabase Migration Master Plan

## Overview

This document serves as the master roadmap for migrating the application from Firebase to Supabase. The migration involves replacing Firebase services (Auth, Firestore, Storage) with their Supabase equivalents (Auth, Postgres, Storage).

## How to Use This Plan

1. **Review the entire plan** to understand the scope of the migration
2. **Work through tasks sequentially** - each task builds on previous ones
3. **Check off completed items** in the progress checklist below
4. **Reference individual implementation docs** for detailed steps
5. **Test thoroughly** after each major milestone

## Migration Strategy

Since we're treating this as a new app (no data migration needed), we can:
- Remove all Firebase dependencies
- Implement Supabase equivalents from scratch
- Update all service files to use Supabase APIs
- Replace Firestore security rules with Supabase Row Level Security (RLS)
- Migrate Firebase Storage to Supabase Storage

## Architecture Changes

### Current (Firebase)
- **Auth**: Firebase Auth with Google Sign-In
- **Database**: Firestore (NoSQL document database)
- **Storage**: Firebase Storage
- **Security**: Firestore Rules + Storage Rules
- **Real-time**: Firestore `onSnapshot` listeners

### Target (Supabase)
- **Auth**: Supabase Auth with Google OAuth
- **Database**: Supabase Postgres (SQL relational database)
- **Storage**: Supabase Storage
- **Security**: Row Level Security (RLS) policies
- **Real-time**: Supabase Realtime subscriptions

## Migration Tasks

### Phase 1: Setup & Configuration
- [x] **Task 1.1**: Supabase Project Setup
  - Create Supabase project
  - Configure environment variables
  - Install Supabase client library
  - See: `01-supabase-setup.md`

- [x] **Task 1.2**: Database Schema Design
  - Design Postgres schema equivalent to Firestore structure
  - Create migration scripts
  - Set up database tables
  - See: `02-database-schema.md`

- [x] **Task 1.3**: Storage Bucket Configuration
  - Create Supabase storage buckets
  - Configure bucket policies
  - Set up CORS if needed
  - See: `03-storage-setup.md`

### Phase 2: Authentication Migration
- [x] **Task 2.1**: Supabase Auth Client Setup
  - Replace Firebase Auth initialization
  - Configure Google OAuth provider
  - Update auth context
  - See: `04-auth-client-setup.md`

- [x] **Task 2.2**: Authentication Service Migration
  - Migrate sign-in/sign-out functions
  - Update user document creation logic
  - Handle auth state persistence
  - See: `05-auth-service-migration.md`

- [x] **Task 2.3**: Auth Context Update
  - Update AuthContext to use Supabase
  - Maintain same interface for components
  - Update auth state listeners
  - See: `06-auth-context-update.md`

### Phase 3: Database Migration
- [x] **Task 3.1**: Core Database Service
  - Create database utility functions (timestamp conversion, error handling)
  - Services use Supabase's native query builder directly
  - Optimize for Postgres/SQL patterns, not Firestore abstractions
  - See: `07-database-service.md`

- [x] **Task 3.2**: Account Service Migration
  - Migrate account CRUD operations using Supabase query builder
  - Update account membership logic
  - Use SQL joins and relational queries
  - See: `08-account-service-migration.md`

- [x] **Task 3.3**: Inventory Service Migration
  - Migrate project operations
  - Migrate item operations
  - Migrate transaction operations
  - Convert complex queries and aggregations
  - See: `09-inventory-service-migration.md`

- [x] **Task 3.4**: Business Profile Service Migration
  - Migrate business profile operations
  - Update logo URL handling
  - See: `10-business-profile-migration.md`

- [x] **Task 3.5**: Tax Presets Service Migration
  - Migrate tax presets operations
  - Update settings storage
  - See: `11-tax-presets-migration.md`

### Phase 4: Storage Migration
- [x] **Task 4.1**: Image Upload Service Migration
  - Replace Firebase Storage with Supabase Storage
  - Update upload/download functions
  - Migrate progress tracking
  - Update image URL handling
  - See: `12-image-service-migration.md`

### Phase 5: Security & Authorization
- [x] **Task 5.1**: Row Level Security Policies
  - Create RLS policies for all tables
  - Implement Postgres-based security policies
  - Test authorization logic
  - See: `13-rls-policies.md`

- [x] **Task 5.2**: Storage Policies
  - Create storage bucket policies
  - Migrate Firebase Storage rules
  - Test file access permissions
  - See: `14-storage-policies.md`

### Phase 6: Real-time Features
- [x] **Task 6.1**: Real-time Subscriptions
  - Implement Supabase Realtime subscriptions
  - Update real-time listeners
  - Test real-time updates
  - See: `15-realtime-migration.md`

### Phase 7: Component Updates
- [x] **Task 7.1**: Auth Components Update
  - Update Login component
  - Update ProtectedRoute component
  - Update UserManagement component
  - See: `16-auth-components-update.md`

- [x] **Task 7.2**: Service Hook Updates
  - Update any hooks that depend on Firebase
  - Ensure compatibility with Supabase
  - See: `17-hooks-update.md`

### Phase 8: Testing & Cleanup
- [ ] **Task 8.1**: Remove Firebase Dependencies
  - Remove Firebase packages from package.json
  - Remove Firebase configuration files
  - Remove Firebase-related scripts
  - See: `18-firebase-cleanup.md`

- [ ] **Task 8.2**: Update Build Configuration
  - Remove Firebase deployment configs
  - Update environment variable documentation
  - Update deployment scripts
  - See: `19-build-config-update.md`

- [ ] **Task 8.3**: Testing & Validation
  - Test all authentication flows
  - Test all CRUD operations
  - Test file uploads/downloads
  - Test real-time features
  - Test authorization and security
  - See: `20-testing-validation.md`

## Progress Checklist

### Phase 1: Setup & Configuration
- [x] Task 1.1: Supabase Project Setup
- [x] Task 1.2: Database Schema Design
- [x] Task 1.3: Storage Bucket Configuration

### Phase 2: Authentication Migration
- [x] Task 2.1: Supabase Auth Client Setup
- [x] Task 2.2: Authentication Service Migration
- [x] Task 2.3: Auth Context Update

### Phase 3: Database Migration
- [x] Task 3.1: Core Database Service
- [x] Task 3.2: Account Service Migration
- [x] Task 3.3: Inventory Service Migration
- [x] Task 3.4: Business Profile Service Migration
- [x] Task 3.5: Tax Presets Service Migration

### Phase 4: Storage Migration
- [x] Task 4.1: Image Upload Service Migration

### Phase 5: Security & Authorization
- [x] Task 5.1: Row Level Security Policies
- [x] Task 5.2: Storage Policies

### Phase 6: Real-time Features
- [x] Task 6.1: Real-time Subscriptions

### Phase 7: Component Updates
- [x] Task 7.1: Auth Components Update
- [x] Task 7.2: Service Hook Updates

### Phase 8: Testing & Cleanup
- [ ] Task 8.1: Remove Firebase Dependencies
- [ ] Task 8.2: Update Build Configuration
- [ ] Task 8.3: Testing & Validation

## Key Considerations

### Data Model Changes
- **Postgres** uses relational SQL structure with tables, rows, and foreign keys
- Use SQL joins for relationships instead of document references
- JSONB columns can store structured data when needed
- Leverage Postgres features: indexes, constraints, triggers, functions

### Query Approach
- **Use Supabase's native query builder** directly: `supabase.from(table).select()...`
- Leverage SQL power: joins, aggregations, subqueries, window functions
- No abstraction layer - work directly with Postgres tables and relationships
- Use utility functions for timestamp conversion and error handling only

### Real-time Updates
- **Supabase**: Realtime subscriptions via `supabase.channel()`
- Subscribe to table changes, filter by RLS policies
- More powerful than Firestore listeners with SQL-based filtering

### Authentication
- **Firebase Auth**: `signInWithPopup()`, `onAuthStateChanged()`
- **Supabase Auth**: `signInWithOAuth()`, `onAuthStateChange()`
- Similar concepts but different API

### Storage
- **Firebase Storage**: `ref()`, `uploadBytesResumable()`, `getDownloadURL()`
- **Supabase Storage**: `from()`, `upload()`, `getPublicUrl()`
- Different API but similar functionality

## Dependencies to Add

```json
{
  "@supabase/supabase-js": "^2.x.x"
}
```

## Dependencies to Remove

```json
{
  "firebase": "^10.7.1",
  "firebase-admin": "^13.5.0"
}
```

## Environment Variables

### Current (Firebase)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

### New (Supabase)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Notes

- This migration treats the app as new (no data migration needed)
- All Firebase-specific code should be removed after migration
- Maintain backward compatibility in component interfaces where possible
- Test thoroughly after each phase before moving to the next
- Update documentation as you go

