# Account System & Business Profile Implementation - Handoff Document

## Overview

This document tracks the remaining work for implementing the multi-tenant hierarchical data structure and business profile system. **Most of the infrastructure work is complete** - the main remaining task is updating all components and pages to use the `useAccount()` hook.

**Last Updated**: Status update after completing service layer, business profile features, security rules, indexes, and migration scripts.

**Plan Reference**: `.cursor/plans/business-profile-system-4bcf471b.plan.md`

## ✅ Completed Work

### Phase 1: Account System Foundation (COMPLETE)
- ✅ Account types & interfaces created in `src/types/index.ts`
- ✅ AccountService created (`src/services/accountService.ts`)
- ✅ AccountContext created (`src/contexts/AccountContext.tsx`)
- ✅ AuthContext updated with `isOwner()` and account assignment (`src/contexts/AuthContext.tsx`)
- ✅ Firebase user creation updated to create default accounts (`src/services/firebase.ts`)
- ✅ App.tsx wrapped with AccountProvider and BusinessProfileProvider

### Phase 2: Service Restructuring (COMPLETE)
- ✅ `projectService` - All methods account-scoped
- ✅ `transactionService` - All methods account-scoped
- ✅ `auditService` - All methods account-scoped
- ✅ `taxPresetsService` - All methods account-scoped
- ✅ `unifiedItemsService` - All methods account-scoped:
  - ✅ `getItemsByProject()`
  - ✅ `getBusinessInventoryItems()`
  - ✅ `subscribeToItemsByProject()`
  - ✅ `subscribeToBusinessInventory()`
  - ✅ `createItem()`
  - ✅ `updateItem()`
  - ✅ `deleteItem()`
  - ✅ `getItemsForTransaction()`
  - ✅ `getItemById()`
  - ✅ `createTransactionItems()`
  - ✅ `duplicateItem()`
  - ✅ `allocateItemToProject()` - **COMPLETE** (all helpers updated)
  - ✅ All allocation/deallocation helper methods (handleSaleToInventoryMove, handleSaleToDifferentProjectMove, etc.)
  - ✅ Transaction management helpers (removeItemFromTransaction, addItemToTransaction)
  - ✅ Batch operations (batchAllocateItemsToProject)
  - ✅ Return operations (returnItemFromProject, handleReturnFromPurchase, handleNewReturn)
  - ✅ Complete pending transaction (completePendingTransaction)
  - ✅ Deallocation service (handleInventoryDesignation, ensureSaleTransaction)
  - ✅ Integration service (all methods updated)

### Phase 4: Business Profile (COMPLETE)
- ✅ `businessProfileService` created (`src/services/businessProfileService.ts`)
- ✅ `BusinessProfileContext` created (`src/contexts/BusinessProfileContext.tsx`)
- ✅ App.tsx wrapped with BusinessProfileProvider
- ✅ Business Profile section added to Settings page (`src/pages/Settings.tsx`)
- ✅ Business logo upload method added to `imageService.ts` (`uploadBusinessLogo()`)
- ✅ Header component updated to use `businessName` from context
- ✅ ProjectInvoice updated to use business profile (name and logo)

## 🔨 Remaining Work

### Phase 2: Service Restructuring (COMPLETE ✅)
All helper methods in `inventoryService.ts` have been updated to be account-scoped. All Firestore paths have been updated to use account-scoped collections.

### Phase 3: Update All Components

**General Pattern**: All components that call service methods need to:
1. Import and use `useAccount()` hook
2. Get `currentAccountId` from the hook
3. Pass `accountId` as the first parameter to all service calls

#### Components Requiring Updates

**File Search Pattern**: Search for imports of service methods:
```bash
grep -r "projectService\|transactionService\|unifiedItemsService\|taxPresetsService" src/pages src/components
```

**Key Files to Update**:

1. **Pages** (`src/pages/`):
   - `Projects.tsx` - `projectService.getProjects()` → `projectService.getProjects(accountId)`
   - `ProjectDetail.tsx` - All project and item service calls
   - `AddTransaction.tsx` - `transactionService.createTransaction()` → `transactionService.createTransaction(accountId, ...)`
   - `EditTransaction.tsx` - All transaction service calls
   - `TransactionDetail.tsx` - All transaction and item service calls
   - `AddItem.tsx` - `unifiedItemsService.createItem()` → `unifiedItemsService.createItem(accountId, ...)`
   - `EditItem.tsx` - All item service calls
   - `ItemDetail.tsx` - All item service calls
   - `BusinessInventory.tsx` - `unifiedItemsService.getBusinessInventoryItems()` → `unifiedItemsService.getBusinessInventoryItems(accountId, ...)`
   - `AddBusinessInventoryItem.tsx` - Item creation calls
   - `EditBusinessInventoryItem.tsx` - Item update calls
   - `BusinessInventoryItemDetail.tsx` - Item service calls
   - `AddBusinessInventoryTransaction.tsx` - Transaction creation calls
   - `EditBusinessInventoryTransaction.tsx` - Transaction update calls
   - `ProjectInvoice.tsx` - Use `businessName` and `businessLogoUrl` from `useBusinessProfile()`

2. **Components** (`src/components/`):
   - `TaxPresetsManager.tsx` - `getTaxPresets()` → `getTaxPresets(accountId)`, `updateTaxPresets()` → `updateTaxPresets(accountId, ...)`
   - `TransactionItemForm.tsx` - Any service calls
   - `TransactionItemsList.tsx` - Any service calls
   - `UserManagement.tsx` - Update invitation creation to include `accountId`:
     ```typescript
     // In createUserInvitation call:
     await createUserInvitation(inviteEmail.trim(), inviteRole, currentUser?.id || '', currentAccountId)
     ```

3. **Header Component** (`src/components/layout/Header.tsx`):
   - Use `businessName` from `useBusinessProfile()` instead of `COMPANY_NAME`
   ```typescript
   import { useBusinessProfile } from '../../contexts/BusinessProfileContext'
   
   const { businessName } = useBusinessProfile()
   // Use businessName instead of COMPANY_NAME
   ```

**Example Component Update**:
```typescript
// OLD:
import { projectService } from '../services/inventoryService'

function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  
  useEffect(() => {
    projectService.getProjects().then(setProjects)
  }, [])
}

// NEW:
import { projectService } from '../services/inventoryService'
import { useAccount } from '../contexts/AccountContext'

function Projects() {
  const { currentAccountId } = useAccount()
  const [projects, setProjects] = useState<Project[]>([])
  
  useEffect(() => {
    if (currentAccountId) {
      projectService.getProjects(currentAccountId).then(setProjects)
    }
  }, [currentAccountId])
}
```

### Phase 4: Business Profile (COMPLETE ✅)
All business profile features have been implemented:
- ✅ Settings page updated with Business Profile section (admin-only)
- ✅ Logo upload method added to `imageService.ts` (`uploadBusinessLogo()`)
- ✅ ProjectInvoice updated to use business profile (name and logo)
- ✅ Header component updated to use `businessName` from context

### Phase 5: Security Rules (COMPLETE ✅)

#### Firestore Security Rules

**File**: `firestore.rules` - ✅ **UPDATED**

Account-scoped security rules have been implemented with helper functions for:
- Account membership checking
- System owner identification
- Account admin permissions
- Account-scoped collections (projects, items, transactions, settings, audit logs)
- Legacy collection support for backward compatibility during migration

#### Storage Rules

**File**: `storage.rules` - ✅ **UPDATED**

Account-scoped storage rules have been implemented for:
- Business logo uploads at `accounts/{accountId}/business_profile/logo/{fileName}`
- Public read access for logos
- Admin-only write access for logos
- Backward compatibility for existing image paths

### Phase 6: Data Migration (COMPLETE ✅)

#### Migration Script

**File**: `migration/migrate-to-accounts.cjs` - ✅ **CREATED**

Migration script has been created and implements:
1. ✅ Creates default account (`default`)
2. ✅ Makes first user system owner
3. ✅ Maps old roles to new structure:
   - `OWNER`/`owner` → system `owner` (on User document)
   - `ADMIN`/`admin` → account `admin` (in membership)
   - `DESIGNER`/`designer`/`VIEWER`/`viewer` → account `user` (in membership)
4. ✅ Migrates all data to account-scoped paths:
   - `projects/{id}` → `accounts/{accountId}/projects/{id}`
   - `items/{id}` → `accounts/{accountId}/items/{id}`
   - `transactions/{id}` → `accounts/{accountId}/transactions/{id}`
   - `settings/{id}` → `accounts/{accountId}/settings/{id}`
   - `audit_logs/{id}` → `accounts/{accountId}/audit_logs/{id}`
   - `transaction_audit_logs/{id}` → `accounts/{accountId}/transaction_audit_logs/{id}`
5. ✅ Creates membership documents for all users

**Usage**: `node migration/migrate-to-accounts.cjs`

#### Migration Validation Script

**File**: `migration/validate-accounts-migration.cjs` - ✅ **CREATED**

Validation script has been created and checks:
1. ✅ Verifies all data migrated (counts match)
2. ✅ Validates account assignments (users have accountId)
3. ✅ Validates role mappings (system owners, memberships)
4. ✅ Checks for orphaned data (compares legacy vs new collections)

**Usage**: `node migration/validate-accounts-migration.cjs`

### Phase 7: Firestore Indexes (COMPLETE ✅)

**File**: `firestore.indexes.json` - ✅ **UPDATED**

Firestore indexes have been updated for account-scoped queries:
- ✅ Projects: `updatedAt` descending
- ✅ Items: `project_id` + `last_updated` descending
- ✅ Items: `transaction_id` + `date_created` ascending
- ✅ Transactions: `project_id` + `created_at` descending
- ✅ Transactions: `reimbursement_type` + `created_at` descending
- ✅ Transactions: `status` + `created_at` descending

**Note**: Since data is now in account-scoped subcollections (`accounts/{accountId}/projects`, etc.), collection group queries work correctly. The indexes support the queries performed within each account's collections.

## Testing Checklist

After completing the remaining work, test:

- [ ] System owner can create accounts
- [ ] System owner can change roles in any account
- [ ] System owner can access data across accounts
- [ ] Account admin can only manage their own account
- [ ] Account user cannot access admin features
- [ ] First user becomes system owner
- [ ] Role assignment in account memberships works
- [ ] Data isolation between accounts works
- [ ] Business profile (admin-only, owner can do any)
- [ ] Migration script with role mapping works
- [ ] All service methods work with accountId
- [ ] All components correctly use useAccount hook
- [ ] Security rules prevent unauthorized access

## Important Notes

1. **Breaking Changes**: All service method signatures have changed. This will cause TypeScript errors until all components are updated.

2. **Migration Strategy**: 
   - Run migration script in development/staging first
   - Validate migration before production
   - Have rollback plan ready

3. **Backward Compatibility**: Consider maintaining backward compatibility layer if needed for gradual migration.

4. **Performance**: Account-scoped queries should improve performance by reducing dataset size per query.

5. **Error Handling**: Ensure all components handle `currentAccountId` being null during loading.

## File Reference Summary

### Modified Files
- `src/types/index.ts` - Added Account, AccountMembership, BusinessProfile, Invitation interfaces
- `src/services/accountService.ts` - NEW
- `src/contexts/AccountContext.tsx` - NEW
- `src/contexts/AuthContext.tsx` - Updated
- `src/services/firebase.ts` - Updated for account creation
- `src/services/inventoryService.ts` - Partially updated (main methods done, helpers pending)
- `src/services/taxPresetsService.ts` - Updated
- `src/services/businessProfileService.ts` - NEW
- `src/contexts/BusinessProfileContext.tsx` - NEW
- `src/App.tsx` - Updated with providers

### Files Needing Updates
- ⚠️ **All component files in `src/pages/` and `src/components/`** - Add useAccount hook and pass accountId to service calls
  - See Phase 3 section below for detailed list and pattern

### Files Completed ✅
- ✅ `src/services/inventoryService.ts` - All helper methods updated to be account-scoped
- ✅ `src/pages/Settings.tsx` - Business Profile section added
- ✅ `src/services/imageService.ts` - Logo upload method added
- ✅ `src/components/layout/Header.tsx` - Uses businessName from context
- ✅ `src/pages/ProjectInvoice.tsx` - Uses business profile
- ✅ `firestore.rules` - Account-scoped rules implemented
- ✅ `storage.rules` - Account-scoped rules implemented
- ✅ `firestore.indexes.json` - Indexes updated
- ✅ `migration/migrate-to-accounts.cjs` - Migration script created
- ✅ `migration/validate-accounts-migration.cjs` - Validation script created

## Quick Start Guide for Completing Remaining Work

1. **Update Components** (Main Remaining Task):
   - Add `const { currentAccountId } = useAccount()` to each component/page
   - Update all service calls to include `accountId` as first parameter
   - Handle loading states (check if `currentAccountId` is null)
   - See Phase 3 section above for detailed list of files

2. **Run Migration** (After component updates):
   - Test migration script in development/staging: `node migration/migrate-to-accounts.cjs`
   - Validate migration: `node migration/validate-accounts-migration.cjs`
   - Deploy security rules: `firebase deploy --only firestore:rules,storage`
   - Deploy indexes: `firebase deploy --only firestore:indexes`

3. **Test Thoroughly**:
   - Use the testing checklist above
   - Test role permissions
   - Test data isolation
   - Verify all components work with account-scoped data

## Status Summary

**Completed**: ✅
- Phase 1: Account System Foundation
- Phase 2: Service Restructuring (100%)
- Phase 4: Business Profile (100%)
- Phase 5: Security Rules (100%)
- Phase 6: Data Migration Scripts (100%)
- Phase 7: Firestore Indexes (100%)

**Remaining**: ⚠️
- Phase 3: Update All Components (~15-20 files need updates)

