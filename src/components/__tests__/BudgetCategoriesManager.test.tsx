import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetCategoriesManager from '../BudgetCategoriesManager'
import { budgetCategoriesService } from '@/services/budgetCategoriesService'
import { useAccount } from '@/contexts/AccountContext'

// Mock the services and contexts
vi.mock('@/services/budgetCategoriesService')
vi.mock('@/contexts/AccountContext')

const mockCategories = [
  { id: 'cat-1', accountId: 'account-1', name: 'Design Fee', slug: 'design-fee', isArchived: false, metadata: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cat-2', accountId: 'account-1', name: 'Furnishings', slug: 'furnishings', isArchived: false, metadata: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cat-3', accountId: 'account-1', name: 'Archived Category', slug: 'archived', isArchived: true, metadata: null, createdAt: new Date(), updatedAt: new Date() }
]

describe('BudgetCategoriesManager', () => {
  const mockUseAccount = vi.mocked(useAccount)

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccount.mockReturnValue({
      currentAccountId: 'account-1',
      currentAccount: null,
      isOwner: false,
      isAdmin: false,
      loading: false
    })
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue(mockCategories.filter(c => !c.isArchived))
    vi.mocked(budgetCategoriesService.getTransactionCounts).mockResolvedValue(new Map())
  })

  it('should render categories list', async () => {
    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Design Fee')).toBeInTheDocument()
      expect(screen.getByText('Furnishings')).toBeInTheDocument()
    })
  })

  it('should show create form when "Add Category" is clicked', async () => {
    const user = userEvent.setup()
    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Add Category')).toBeInTheDocument()
    })

    const addButton = screen.getByText('Add Category')
    await user.click(addButton)
    
    await waitFor(() => {
      expect(screen.getByText('Create New Category')).toBeInTheDocument()
      expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Slug/)).toBeInTheDocument()
    })
  })

  it('should create a new category', async () => {
    const user = userEvent.setup()
    const newCategory = {
      id: 'cat-new',
      accountId: 'account-1',
      name: 'New Category',
      slug: 'new-category',
      isArchived: false,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    vi.mocked(budgetCategoriesService.createCategory).mockResolvedValue(newCategory)
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue([...mockCategories.filter(c => !c.isArchived), newCategory])

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Add Category')).toBeInTheDocument()
    })

    // Click Add Category
    await user.click(screen.getByText('Add Category'))
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
    })

    // Fill in form
    const nameInput = screen.getByLabelText(/Name/)
    const slugInput = screen.getByLabelText(/Slug/)
    
    await user.type(nameInput, 'New Category')
    await user.type(slugInput, 'new-category')

    // Submit form
    const saveButton = screen.getByRole('button', { name: /Create|Save/ })
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(budgetCategoriesService.createCategory).toHaveBeenCalledWith(
        'account-1',
        'New Category',
        'new-category'
      )
    })
  })

  it('should edit an existing category', async () => {
    const user = userEvent.setup()
    const updatedCategory = {
      ...mockCategories[0],
      name: 'Updated Design Fee',
      slug: 'updated-design-fee'
    }

    vi.mocked(budgetCategoriesService.updateCategory).mockResolvedValue(updatedCategory)
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue([updatedCategory, mockCategories[1]])

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Design Fee')).toBeInTheDocument()
    })

    // Find and click Edit button
    const editButtons = screen.getAllByText('Edit')
    await user.click(editButtons[0])
    
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Design Fee')
      expect(nameInput).toBeInTheDocument()
    })

    // Update name
    const nameInput = screen.getByDisplayValue('Design Fee')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Design Fee')

    // Save
    const saveButton = screen.getByRole('button', { name: /Save/ })
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(budgetCategoriesService.updateCategory).toHaveBeenCalledWith(
        'account-1',
        'cat-1',
        expect.objectContaining({
          name: 'Updated Design Fee'
        })
      )
    })
  })

  it('should archive a category', async () => {
    const user = userEvent.setup()
    const archivedCategory = { ...mockCategories[0], isArchived: true }

    vi.mocked(budgetCategoriesService.archiveCategory).mockResolvedValue(archivedCategory)
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue([mockCategories[1]])

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Design Fee')).toBeInTheDocument()
    })

    // Find and click Archive button
    const archiveButtons = screen.getAllByText('Archive')
    await user.click(archiveButtons[0])
    
    await waitFor(() => {
      expect(budgetCategoriesService.archiveCategory).toHaveBeenCalledWith('account-1', 'cat-1')
    })
  })

  it('should prevent archiving category with transactions', async () => {
    const user = userEvent.setup()
    const transactionCounts = new Map([['cat-1', 5]])

    vi.mocked(budgetCategoriesService.getTransactionCounts).mockResolvedValue(transactionCounts)

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Design Fee')).toBeInTheDocument()
    })

    // Archive button should be disabled
    const archiveButtons = screen.getAllByText('Archive')
    const archiveButton = archiveButtons.find(btn => 
      btn.closest('tr')?.textContent?.includes('Design Fee')
    )
    
    expect(archiveButton).toBeDisabled()
  })

  it('should show transaction counts', async () => {
    const transactionCounts = new Map([
      ['cat-1', 3],
      ['cat-2', 0]
    ])

    vi.mocked(budgetCategoriesService.getTransactionCounts).mockResolvedValue(transactionCounts)

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText(/3 transaction/)).toBeInTheDocument()
    })
  })

  it('should show archived categories when toggle is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue(mockCategories)

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Design Fee')).toBeInTheDocument()
    })

    // Find "Show Archived" button
    const showArchivedButton = screen.getByText(/Show.*Archived/i)
    await user.click(showArchivedButton)
    
    await waitFor(() => {
      expect(budgetCategoriesService.getCategories).toHaveBeenCalledWith('account-1', true)
      expect(screen.getByText('Archived Category')).toBeInTheDocument()
    })
  })

  it('should handle bulk archive operations', async () => {
    const user = userEvent.setup()
    const bulkResult = {
      successful: ['cat-2'],
      failed: []
    }

    vi.mocked(budgetCategoriesService.bulkArchiveCategories).mockResolvedValue(bulkResult)
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue([mockCategories[0]])

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Bulk Operations')).toBeInTheDocument()
    })

    // Click Bulk Operations
    await user.click(screen.getByText('Bulk Operations'))
    
    await waitFor(() => {
      expect(screen.getByText(/Select categories to archive/)).toBeInTheDocument()
    })

    // Select a category
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // First category checkbox
    
    // Click Archive Selected
    const archiveSelectedButton = screen.getByText(/Archive Selected/)
    await user.click(archiveSelectedButton)
    
    await waitFor(() => {
      expect(budgetCategoriesService.bulkArchiveCategories).toHaveBeenCalled()
    })
  })

  it('should display error messages', async () => {
    vi.mocked(budgetCategoriesService.getCategories).mockRejectedValue(new Error('Failed to load categories'))

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load budget categories/)).toBeInTheDocument()
    })
  })

  it('should display success messages', async () => {
    const user = userEvent.setup()
    const newCategory = {
      id: 'cat-new',
      accountId: 'account-1',
      name: 'New Category',
      slug: 'new-category',
      isArchived: false,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    vi.mocked(budgetCategoriesService.createCategory).mockResolvedValue(newCategory)
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue([...mockCategories.filter(c => !c.isArchived), newCategory])

    render(<BudgetCategoriesManager />)
    
    await waitFor(() => {
      expect(screen.getByText('Add Category')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add Category'))
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Name/), 'New Category')
    await user.type(screen.getByLabelText(/Slug/), 'new-category')
    await user.click(screen.getByRole('button', { name: /Create/ }))
    
    await waitFor(() => {
      expect(screen.getByText(/Category created successfully/)).toBeInTheDocument()
    })
  })
})

