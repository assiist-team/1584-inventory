# Enhanced Transaction System Design

## Overview

Rather than creating a separate "reimbursements" object, we can extend the existing Transaction system to handle planned financial obligations. This approach is simpler, more consistent, and leverages your current transaction infrastructure.

## Core Philosophy

**Pending Transactions** represent planned financial transfers that haven't occurred yet:
- **Client owes us**: Items/services we provide that client needs to pay for
- **We owe client**: Items/services client provides that we need to reimburse

This cleanly separates planned obligations from completed transactions using status, while keeping everything in one unified system.

## Data Model

### Enhanced Transaction Entity
```typescript
interface Transaction {
  // ... existing fields ...
  transaction_id: string
  project_id: string
  transaction_date: string
  source: string
  transaction_type: string
  payment_method: string
  amount: string
  budget_category?: string
  notes?: string
  created_by: string

  // NEW: Pending Transaction fields
  status: 'pending' | 'completed' | 'cancelled'
  reimbursement_type?: 'Client owes us' | 'We owe client'
  trigger_event?: 'Inventory allocation' | 'Inventory return' | 'Purchase from client' | 'Manual'
}
```

### Key Insights:
- **No new object type needed** - just extend existing Transaction
- **Status field** distinguishes pending from completed transactions
- **Optional reimbursement_type** only for transactions representing reimbursements
- **Uses existing created_by** - set to "system" for auto-generated transactions
- **Uses existing transaction-item associations** - no need for separate related_item_id
- **Same record updates status** - no separate settled_transaction_id needed
- **Backwards compatible** - existing transactions work unchanged

## Transaction Status Workflow

1. **Regular Transaction**: `status: 'completed'` (default) - Normal completed transactions
2. **Pending Reimbursement**: `status: 'pending'` + `reimbursement_type` - Planned obligations
3. **Completed Reimbursement**: `status: 'completed'` + `reimbursement_type` - Paid obligations
4. **Cancelled Reimbursement**: `status: 'cancelled'` + `reimbursement_type` - Cancelled obligations

### Auto-Creation for Reimbursement Scenarios
- **Inventory to Project**: Auto-creates "Client owes us" transaction
- **Client Purchase to Inventory**: Auto-creates "We owe client" transaction

## Automation Rules & Triggers

### 1. Inventory Item Allocated to Project → Auto-Create Pending Transaction
**Trigger**: Item moved from business inventory to project inventory
**Action**: Create `pending` transaction with `reimbursement_type: 'Client owes us'`

**Logic**:
```typescript
// When allocating inventory item to project
if (item.source === 'business_inventory' && moving_to_project) {
  createTransaction({
    // Standard transaction fields
    project_id: project.id,
    transaction_type: 'reimbursement',
    source: 'inventory_allocation',
    amount: item.market_value || item.price,
    budget_category: 'Furnishings',
    description: `Inventory item: ${item.description}`,
    created_by: 'system',

    // NEW: Pending transaction fields
    status: 'pending',
    reimbursement_type: 'Client owes us',
    trigger_event: 'Inventory allocation'
  })
}
```

**Example**: Designer allocates a $500 sofa from warehouse to Smith project → Auto-creates pending transaction "Client owes us $500 for sofa".

### 2. Client-Purchased Item Moved to Inventory → Auto-Create Pending Transaction
**Trigger**: Item purchased by client moved to business inventory
**Action**: Create `pending` transaction with `reimbursement_type: 'We owe client'`

**Logic**:
```typescript
// When client-purchased item moved to business inventory
if (item.source === 'client_purchase' && moving_to_business_inventory) {
  createTransaction({
    // Standard transaction fields
    project_id: project.id,
    transaction_type: 'reimbursement',
    source: 'client_purchase',
    amount: item.price,
    budget_category: 'Furnishings',
    description: `Client-purchased item: ${item.description}`,
    created_by: 'system',

    // NEW: Pending transaction fields
    status: 'pending',
    reimbursement_type: 'We owe client',
    trigger_event: 'Purchase from client'
  })
}
```

**Example**: Client buys $300 lamp and donates it to project → Item moved to business inventory → Auto-creates pending transaction "We owe client $300 for lamp".

## UI Integration Notes

The reimbursement system adds data fields that your existing transaction UI can use for display and filtering:

**Data Available:**
- `status`: 'pending' | 'completed' | 'cancelled'
- `reimbursement_type`: 'Client owes us' | 'We owe client' | null
- `trigger_event`: How transaction was created

**Required UI Features:**
- **Pending Filter**: Add filter option to show only pending transactions
- **Auto-Grouping**: When pending filter is active, group results by `reimbursement_type`
- **Status Badges**: Show "Client owes" / "We owe" badges for pending transactions
- **Status Updates**: Add actions to mark transactions as completed or cancelled

**Implementation Approach:**
- Extend existing transaction list with pending filter
- Use existing grouping/filtering infrastructure if available



```

## Workflow Integration

### With Existing Inventory System

**Enhanced Item Entity** (if needed):
```typescript
interface Item {
  // ... existing fields ...
  // No additional fields needed - use existing transaction-item associations
}
```

**Transaction Creation**:
- Users manually create reimbursement transactions when planning obligations
- No automatic transaction creation for inventory movements
- Transactions can be created with `status: 'pending'` for planned reimbursements

### With Transaction System

**Transaction Updates**:
```typescript
// When a reimbursement transaction gets paid, update its status
if (transaction.reimbursement_type === 'Client owes us' && transaction.status === 'pending') {
  // Client is paying us for something we provided
  updateTransaction(transaction.id, {
    status: 'completed',
    transaction_date: new Date().toISOString(), // Record when it was actually paid
    payment_method: 'client_payment' // Or whatever method was used
  })
}

if (transaction.reimbursement_type === 'We owe client' && transaction.status === 'pending') {
  // We're paying client for something they provided
  updateTransaction(transaction.id, {
    status: 'completed',
    transaction_date: new Date().toISOString(),
    payment_method: 'business_reimbursement'
  })
}
```







