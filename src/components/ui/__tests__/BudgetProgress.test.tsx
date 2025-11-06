// React import unused in modern JSX runtime; removed to fix TS6133
import { render, screen, waitFor } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import BudgetProgress from '../BudgetProgress'
import { BudgetCategory, ProjectBudgetCategories, Transaction } from '@/types'

const makeTransaction = (overrides: Partial<Transaction>): Transaction => ({
  transaction_id: overrides.transaction_id || Math.random().toString(36).slice(2),
  transaction_date: overrides.transaction_date || new Date().toISOString(),
  source: overrides.source || 'Test',
  transaction_type: overrides.transaction_type || 'Purchase',
  payment_method: overrides.payment_method || 'Card',
  amount: overrides.amount || '0',
  budget_category: overrides.budget_category,
  receipt_emailed: false,
  created_at: new Date().toISOString(),
  created_by: 'test',
  status: overrides.status || 'completed',
})

describe('BudgetProgress calculations', () => {
  test('Furnishings handles purchases and returns correctly', async () => {
    const budgetCategories: ProjectBudgetCategories = {
      designFee: 0,
      furnishings: 1000,
      propertyManagement: 0,
      kitchen: 0,
      install: 0,
      storageReceiving: 0,
      fuel: 0,
    }

    const transactions: Transaction[] = [
      makeTransaction({ amount: '300', budget_category: BudgetCategory.FURNISHINGS, transaction_type: 'Purchase' }),
      makeTransaction({ amount: '200', budget_category: BudgetCategory.FURNISHINGS, transaction_type: 'Purchase' }),
      makeTransaction({ amount: '100', budget_category: BudgetCategory.FURNISHINGS, transaction_type: 'Return' }),
    ]

    const { container } = render(
      <BudgetProgress
        budget={1000}
        budgetCategories={budgetCategories}
        transactions={transactions}
      />
    )

    // Wait for async calculations to finish
    await waitFor(() => expect(screen.getByText(/Furnishings Budget/)).toBeInTheDocument())

    // Spent should be 300 + 200 - 100 = 400
    expect(screen.getByText(/\$400\s+spent/)).toBeInTheDocument()
    // Remaining should be 1000 - 400 = 600 (text may be split across elements)
    const remainingElements = screen.getAllByText((content, element) => {
      const hasText = element?.textContent?.includes('$600') && element?.textContent?.includes('remaining')
      return Boolean(hasText)
    })
    expect(remainingElements.length).toBeGreaterThan(0)

    // Progress bar width should be 40%
    const styledDivs = Array.from(container.querySelectorAll('div[style]'))
    const has40 = styledDivs.some(d => (d as HTMLElement).style.width === '40%')
    expect(has40).toBe(true)
  })

  test('Install category calculates correctly with multiple purchases', async () => {
    const budgetCategories: ProjectBudgetCategories = {
      designFee: 0,
      furnishings: 0,
      propertyManagement: 0,
      kitchen: 0,
      install: 800,
      storageReceiving: 0,
      fuel: 0,
    }

    const transactions: Transaction[] = [
      makeTransaction({ amount: '300', budget_category: BudgetCategory.INSTALL, transaction_type: 'Purchase' }),
      makeTransaction({ amount: '200', budget_category: BudgetCategory.INSTALL, transaction_type: 'Purchase' }),
    ]

    const { container } = render(
      <BudgetProgress
        budget={800}
        budgetCategories={budgetCategories}
        transactions={transactions}
      />
    )

    await waitFor(() => expect(screen.getByText(/Install Budget/)).toBeInTheDocument())

    // Spent should be 500
    expect(screen.getByText(/\$500\s+spent/)).toBeInTheDocument()
    // Remaining should be 300 (text may be split across elements)
    const remainingElements = screen.getAllByText((content, element) => {
      const hasText = element?.textContent?.includes('$300') && element?.textContent?.includes('remaining')
      return Boolean(hasText)
    })
    expect(remainingElements.length).toBeGreaterThan(0)

    const styledDivs = Array.from(container.querySelectorAll('div[style]'))
    const hasPercent = styledDivs.some(d => (d as HTMLElement).style.width === '62.5%')
    // Allow slight variance depending on rounding: expect a width that matches 62.5% or 63%
    const has63 = styledDivs.some(d => (d as HTMLElement).style.width === '63%')
    expect(hasPercent || has63).toBe(true)
  })

  test('Storage & Receiving handles a return and purchase', async () => {
    const budgetCategories: ProjectBudgetCategories = {
      designFee: 0,
      furnishings: 0,
      propertyManagement: 0,
      kitchen: 0,
      install: 0,
      storageReceiving: 400,
      fuel: 0,
    }

    const transactions: Transaction[] = [
      makeTransaction({ amount: '250', budget_category: BudgetCategory.STORAGE_RECEIVING, transaction_type: 'Purchase' }),
      makeTransaction({ amount: '50', budget_category: BudgetCategory.STORAGE_RECEIVING, transaction_type: 'Return' }),
    ]

    const { container } = render(
      <BudgetProgress
        budget={400}
        budgetCategories={budgetCategories}
        transactions={transactions}
      />
    )

    await waitFor(() => expect(screen.getByText(/Storage & Receiving Budget/)).toBeInTheDocument())

    // Spent should be 200
    expect(screen.getByText(/\$200\s+spent/)).toBeInTheDocument()
    // Remaining should be 200 (text may be split across elements)
    const remainingElements = screen.getAllByText((content, element) => {
      const hasText = element?.textContent?.includes('$200') && element?.textContent?.includes('remaining')
      return Boolean(hasText)
    })
    expect(remainingElements.length).toBeGreaterThan(0)

    const styledDivs = Array.from(container.querySelectorAll('div[style]'))
    const has50 = styledDivs.some(d => (d as HTMLElement).style.width === '50%')
    expect(has50).toBe(true)
  })

  test('Fuel category with zero budget does not render', async () => {
    const budgetCategories: ProjectBudgetCategories = {
      designFee: 0,
      furnishings: 0,
      propertyManagement: 0,
      kitchen: 0,
      install: 0,
      storageReceiving: 0,
      fuel: 0,
    }

    const transactions: Transaction[] = [
      makeTransaction({ amount: '50', budget_category: BudgetCategory.FUEL, transaction_type: 'Purchase' }),
    ]

    render(
      <BudgetProgress
        budget={0}
        budgetCategories={budgetCategories}
        transactions={transactions}
      />
    )

    // Fuel has zero budget defined so it should not show a category row
    await waitFor(() => {
      const fuelLabel = screen.queryByText(/Fuel Budget/)
      expect(fuelLabel).toBeNull()
    })
  })

  test('Design Fee tracks received and remaining correctly', async () => {
    const budgetCategories: ProjectBudgetCategories = {
      designFee: 0,
      furnishings: 0,
      propertyManagement: 0,
      kitchen: 0,
      install: 0,
      storageReceiving: 0,
      fuel: 0,
    }

    const designFeeAmount = 1000

    const transactions: Transaction[] = [
      makeTransaction({ amount: '400', budget_category: BudgetCategory.DESIGN_FEE, transaction_type: 'Purchase' }),
      makeTransaction({ amount: '100', budget_category: BudgetCategory.DESIGN_FEE, transaction_type: 'Return' }),
    ]

    const { container } = render(
      <BudgetProgress
        budget={0}
        designFee={designFeeAmount}
        budgetCategories={budgetCategories}
        transactions={transactions}
      />
    )

    await waitFor(() => expect(screen.getByText(/Design Fee/)).toBeInTheDocument())

    // Received should be 400 - 100 = 300
    expect(screen.getByText(/\$300\s+received/)).toBeInTheDocument()
    // Remaining should be 1000 - 300 = 700 (text may be split across elements)
    const remainingElements = screen.getAllByText((content, element) => {
      const hasText = element?.textContent?.includes('$700') && element?.textContent?.includes('remaining')
      return Boolean(hasText)
    })
    expect(remainingElements.length).toBeGreaterThan(0)

    // Progress bar should be 30%
    const styledDivs = Array.from(container.querySelectorAll('div[style]'))
    const has30 = styledDivs.some(d => (d as HTMLElement).style.width === '30%')
    expect(has30).toBe(true)
  })

  test('Kitchen caps at 100% and shows negative remaining when over budget', async () => {
    const budgetCategories: ProjectBudgetCategories = {
      designFee: 0,
      furnishings: 0,
      propertyManagement: 0,
      kitchen: 500,
      install: 0,
      storageReceiving: 0,
      fuel: 0,
    }

    const transactions: Transaction[] = [
      makeTransaction({ amount: '600', budget_category: BudgetCategory.KITCHEN, transaction_type: 'Purchase' }),
    ]

    const { container } = render(
      <BudgetProgress
        budget={500}
        budgetCategories={budgetCategories}
        transactions={transactions}
      />
    )

    await waitFor(() => expect(screen.getByText(/Kitchen Budget/)).toBeInTheDocument())

    // Spent should be 600
    expect(screen.getByText(/\$600\s+spent/)).toBeInTheDocument()
    // Remaining should be 500 - 600 = -100 (text may be split across elements)
    const remainingElements = screen.getAllByText((content, element) => {
      const hasText = element?.textContent?.includes('$-100') && element?.textContent?.includes('remaining')
      return Boolean(hasText)
    })
    expect(remainingElements.length).toBeGreaterThan(0)

    // Progress should be capped to 100%
    const styledDivs = Array.from(container.querySelectorAll('div[style]'))
    const has100 = styledDivs.some(d => (d as HTMLElement).style.width === '100%')
    expect(has100).toBe(true)
  })

  test('Property Management counts returns correctly', async () => {
    const budgetCategories: ProjectBudgetCategories = {
      designFee: 0,
      furnishings: 0,
      propertyManagement: 200,
      kitchen: 0,
      install: 0,
      storageReceiving: 0,
      fuel: 0,
    }

    const transactions: Transaction[] = [
      makeTransaction({ amount: '100', budget_category: BudgetCategory.PROPERTY_MANAGEMENT, transaction_type: 'Purchase' }),
      makeTransaction({ amount: '50', budget_category: BudgetCategory.PROPERTY_MANAGEMENT, transaction_type: 'Return' }),
    ]

    const { container } = render(
      <BudgetProgress
        budget={200}
        budgetCategories={budgetCategories}
        transactions={transactions}
      />
    )

    await waitFor(() => expect(screen.getByText(/Property Management Budget/)).toBeInTheDocument())

    // Spent should be 100 - 50 = 50
    expect(screen.getByText(/\$50\s+spent/)).toBeInTheDocument()
    // Remaining should be 200 - 50 = 150 (text may be split across elements)
    const remainingElements = screen.getAllByText((content, element) => {
      const hasText = element?.textContent?.includes('$150') && element?.textContent?.includes('remaining')
      return Boolean(hasText)
    })
    expect(remainingElements.length).toBeGreaterThan(0)

    // Progress should be 25%
    const styledDivs = Array.from(container.querySelectorAll('div[style]'))
    const has25 = styledDivs.some(d => (d as HTMLElement).style.width === '25%')
    expect(has25).toBe(true)
  })
})


