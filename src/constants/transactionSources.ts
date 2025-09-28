/**
 * Predefined transaction sources for Add/Edit forms
 * These match the sources shown in the UI design
 */
export const TRANSACTION_SOURCES = [
  'Homegoods',
  'Amazon',
  'Wayfair',
  'Target',
  'Ross',
  'Arhaus',
  'Pottery Barn',
  'Crate & Barrel',
  'West Elm',
  'Living Spaces',
  'Home Depot',
  'Lowes',
  'Movers',
  'Gas',
  'Inventory'
] as const

export type TransactionSource = typeof TRANSACTION_SOURCES[number]
