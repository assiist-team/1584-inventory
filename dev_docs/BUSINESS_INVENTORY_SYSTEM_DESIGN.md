# Business Inventory Management System Design

## Overview

The Business Inventory Management system focuses exclusively on managing items owned by the design business. This system handles the core inventory operations while using the existing Transaction system (enhanced with pending transactions) to manage financial obligations when items are allocated to projects.

The system eliminates the need for a separate allocations entity by leveraging the existing transaction infrastructure with status-based workflow for planned financial transfers.

## Architecture

### Core Concepts

1. **Business Inventory Focus**:
   - **Business Inventory**: Central storage/warehouse for business-owned items
   - **Project Interactions**: Handled through pending transactions in the transaction system
   - **No Project Allocation Tabs**: Projects don't have separate allocation interfaces

2. **Status Workflow** (Transaction-Based):
   - **Available**: Item is in business inventory, ready for allocation
   - **Pending**: Item allocated to project, creates pending transaction "Client owes us"
   - **Sold**: Client has paid for the item, transaction marked as completed

### Data Model

#### Enhanced Item Entity
```typescript
interface Item {
  // ... existing fields ...
  inventory_status: 'available' | 'pending' | 'sold'
  current_project_id?: string  // If currently allocated to a project
  business_inventory_location?: string  // Warehouse location details
  pending_transaction_id?: string  // Links to pending transaction when allocated
}
```

#### Enhanced Transaction Entity (from Reimbursements System)
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

  // Pending Transaction fields
  status: 'pending' | 'completed' | 'cancelled'
  reimbursement_type?: 'Client owes us' | 'We owe client'
  trigger_event?: 'Inventory allocation' | 'Inventory return' | 'Purchase from client' | 'Manual'
}
```

## Interface Design

### Tab Structure

**Main App Structure:**
- **Projects** (existing): Project cards → Project detail pages with:
  - **Transactions** (existing): Regular project transactions (including pending transactions for inventory allocations)
  - **Inventory** (existing): Items in this specific project
- **Inventory** (enhanced): Business-wide inventory management with:
  - **Inventory**: Business-owned items with status tracking
  - **Transactions**: All inventory-related transactions (including pending transactions for project allocations)

### Business Inventory Interface

#### Overview Page
- **Filter/Search Bar**: By item, status, location, project assignment
- **Summary Cards**:
  - Total items in business inventory
  - Available items (ready for allocation)
  - Pending items (allocated to projects, awaiting payment)
  - Sold items (paid for by clients)
- **Inventory List**:
  - Sortable columns: Item, Status, Location, Current Project, Date Added
  - Color-coded status badges (Available = green, Allocated = brown, Sold = red)

  **Note**: The inventory list view for the business inventory system should be modeled after the inventory list view in the project system. It should be identical aside from any unique fields specific to either system. If guidance is needed on reconciling field differences between the two systems, please ask for clarification.

#### Detailed Views

1. **Item Detail Page**:
   - Item information and images
   - Current status and project assignment
   - Location history and timeline
   - Linked pending/completed transactions

   **Note**: The item detail page for the business inventory system should be modeled after the item detail page in the project system. It should be identical aside from any unique fields specific to either system. If guidance is needed on reconciling field differences between the two systems, please ask for clarification.

2. **Item Status Management**:
   - Update item status (available → pending → sold)
   - Assign to project (creates pending transaction)
   - Return from project (cancels pending transaction)

### Management and CRUD Operations

**Add and Edit Capabilities**: The business inventory management system must include full add and edit capabilities for both inventory items and transactions, strictly modeled after the project-level capabilities:

1. **Inventory Item Management**:
   - **Add New Items**: Create new inventory items using the same workflow as project-level item creation
   - **Edit Existing Items**: Modify item details, descriptions, values, and other properties
   - **Delete Items**: Remove items from business inventory when no longer needed
   - **Bulk Operations**: Support for bulk adding/editing multiple items efficiently

2. **Transaction Management**:
   - **Add New Transactions**: Create inventory-related transactions (both completed and pending)
   - **Edit Existing Transactions**: Modify transaction details, amounts, dates, and status
   - **Delete Transactions**: Remove transactions when necessary
   - **Status Management**: Change transaction status (pending → completed/cancelled)

**Implementation Note**: These capabilities should be identical to the project-level add/edit functionality in terms of user interface, validation, and workflow. Field differences can be reconciled after the initial implementation is complete.

### Project Interaction Workflow

#### Allocating Items to Projects
1. **Select Item**: Choose available item from business inventory
2. **Select Project**: Choose target project
3. **Set Details**: Specify amount to be billed to client, add notes
4. **Allocate Item**: Creates pending transaction "Client owes us" and updates item status to "pending"

#### Processing Payments
1. **Receive Payment**: When client pays for allocated items
2. **Complete Transaction**: Mark pending transaction as "completed"
3. **Update Item Status**: Change item status from "pending" to "sold"

#### Returning Items from Projects
1. **Return Item**: Move item back from project to business inventory
2. **Cancel Transaction**: Mark related pending transaction as "cancelled"
3. **Update Item Status**: Change item status back to "available"

## Integration Points

### With Existing Systems

1. **Project Budget Tracking**:
   - Pending transactions for inventory allocations appear in project budgets as planned expenses
   - Completed transactions (when clients pay) become actual transactions in the furnishings budget category
   - Each project shows budget impact from both regular transactions and inventory-related pending transactions

2. **Business Inventory Management**:
   - All items tracked with simple status workflow (available → pending → sold)
   - Items linked to pending transactions when allocated to projects
   - Complete history maintained through transaction records

3. **Transaction System Integration**:
   - Pending transactions created automatically when items allocated to projects
   - Transaction status updated when items sold or returned
   - No separate allocation records - all financial tracking through transaction system

### Data Flow

```
Business Inventory Items → Allocate to Project → Pending Transaction (Client owes us)
     ↑                                                           ↓
     └─── Return to Inventory ←───────── Cancel Transaction ←──────┘
                                                        ↓
                                               Complete Transaction
                                               (Client pays us)
```

## User Experience

### Interface Design

**Business Inventory Section (Main App Level):**
1. **Inventory Tab**:
   - List of all business-owned items with status tracking
   - Each item shows: description, value, location, current project assignment, status
   - "Allocate to Project" button to move items to specific projects (creates pending transaction)
   - Status management for returning items from projects

2. **Transactions Tab**:
   - Displays all transactions created for teh business inventory, including all transactions for inventory sold to a client or purchased from a client.
   - Filter by status (pending/completed/cancelled) and reimbursement type (Client owes us/We owe client)

   **Note**: The transaction list view for the business inventory system should be modeled after the transaction list view in the project system. It should be identical aside from any unique fields specific to either system. If guidance is needed on reconciling field differences between the two systems, please ask for clarification.

   **Additional Note**: The transaction detail screen for the business inventory system should be modeled after the transaction detail screen in the project system. It should be identical aside from any unique fields specific to either system. If guidance is needed on reconciling field differences between the two systems, please ask for clarification.

### Search and Filtering

- **Inventory Search**: Search items by description, location, status, project assignment

### Integration with Existing Project System

- **Transaction Creation**: Automatic creation of pending transactions when items are allocated to projects
- **Cross-System Linking**: Inventory items link to their related transactions for complete audit trails

