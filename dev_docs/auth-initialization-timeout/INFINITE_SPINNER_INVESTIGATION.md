# Infinite Spinner Investigation

## Problem Summary
Users experience infinite spinners when navigating to:
1. **Inventory tab** (from Projects tab)
2. **Projects tab** (after sign-in)

This happens **even after account is loaded**, indicating the issue is not just about `accountLoading` state.

## Symptoms
- Infinite spinner on Inventory tab when navigating from Projects tab
- Infinite spinner on Projects tab after sign-in
- Issue resolves with page refresh
- Console shows no obvious errors (after auth callback fixes)

## What We've Tried

### 1. Auth Callback Fix
- ✅ Removed manual `exchangeCodeForSession` call (Supabase handles this automatically)
- ✅ Simplified callback to wait briefly then check session

### 2. Loading State Fixes
- ✅ InventoryList: Now checks `accountLoading` for spinner display
- ✅ Projects: Combined `accountLoading` and `isLoadingData` states
- ⚠️ **BUT**: Issue persists even after account is loaded

## Current Code State

### InventoryList.tsx
- Shows spinner when `accountLoading` is true
- Items come from props (ProjectDetail handles loading)
- Has its own `loading` state (initialized to `false`, never set to `true`)

### Projects.tsx
- Shows spinner when `accountLoading || isLoadingData`
- Waits for account to load before fetching projects
- useEffect depends on `[currentAccountId, accountLoading]`

### ProjectDetail.tsx
- Has `isLoading` state for project data
- Passes `items` prop to InventoryList
- Subscribes to items via `unifiedItemsService.subscribeToProjectItems`

## Potential Root Causes

### 1. Race Condition in Data Loading
- ProjectDetail might be loading items while InventoryList is already rendered
- If `propItems` is undefined/empty initially, InventoryList might show empty state incorrectly
- Check: Does ProjectDetail pass `items` prop correctly on initial render?

### 2. Subscription Issues
- Real-time subscriptions might be interfering with initial load
- Check: Are subscriptions set up before or after initial data fetch?
- Check: Do subscriptions trigger before data is ready?

### 3. useEffect Dependency Issues
- Projects page useEffect might not be re-running when it should
- Check: Are dependencies correct? Is `accountLoading` in the dependency array?

### 4. AccountContext Loading State
- AccountContext has 10-second timeout, but might be stuck before timeout
- Check: Is `accountLoading` actually becoming `false`?
- Check: Are there any errors in AccountContext that prevent loading from completing?

### 5. Component Re-render Issues
- Components might be re-rendering in a way that resets loading states
- Check: Are there unnecessary re-renders causing state resets?

## Investigation Steps

### Step 1: Add Debug Logging
Add console logs to track:
- When `accountLoading` changes
- When `isLoading` states change
- When `propItems` changes in InventoryList
- When useEffect hooks run
- When subscriptions are set up

### Step 2: Check ProjectDetail Item Loading
- Verify `items` state is being set correctly
- Check if `items` prop is passed to InventoryList on initial render
- Verify subscription is set up after initial data load

### Step 3: Check Projects Page Loading Flow
- Verify `accountLoading` actually becomes `false`
- Check if `loadInitialData` is being called when account finishes loading
- Verify projects are being fetched correctly

### Step 4: Check for Stale Closures
- Ensure useEffect dependencies are correct
- Check if callbacks are capturing stale state values

### Step 5: Check Real-time Subscription Timing
- Verify subscriptions don't interfere with initial load
- Check if subscription callbacks are firing before data is ready

## Next Actions

1. ✅ **Add comprehensive logging** to track state changes - DONE
2. **Test with logging** - Navigate to tabs and check console logs
3. **Check ProjectDetail** - verify items are loaded and passed correctly
4. **Check Projects page** - verify account loading completion triggers data fetch
5. **Check subscription timing** - ensure subscriptions don't interfere
6. **Test navigation flow** - trace exact sequence of events when navigating

## Debug Logging Added

Added 🔍 emoji-prefixed console logs to track:

### InventoryList.tsx
- When `accountLoading` changes
- When `propItems` changes
- Current `isLoading` state

### Projects.tsx
- When useEffect triggers
- When `loadInitialData` is called
- Account loading state and account ID
- When projects are loaded

### ProjectDetail.tsx
- When useEffect triggers
- When `loadData` is called
- Account ID availability
- When items are loaded
- When InventoryList is rendered with items

## Testing Instructions

1. Open browser console
2. Navigate to Projects tab - watch for 🔍 logs
3. Click on a project - watch for 🔍 logs
4. Switch to Inventory tab - watch for 🔍 logs
5. Note the sequence of events and any stuck states
6. Look for patterns where `accountLoading` stays `true` or items don't load

## Files to Investigate

- `src/pages/InventoryList.tsx` - Loading state logic
- `src/pages/Projects.tsx` - Account loading and data fetching
- `src/pages/ProjectDetail.tsx` - Item loading and prop passing
- `src/contexts/AccountContext.tsx` - Account loading state management
- `src/services/inventoryService.ts` - Subscription setup and data fetching

## Notes

- User mentioned the issue happens "even after account is loaded" - this suggests the problem is in the data fetching/subscription logic, not account loading
- Refresh fixes the issue - suggests it's a timing/race condition problem
- Need to trace the exact sequence of events during navigation

