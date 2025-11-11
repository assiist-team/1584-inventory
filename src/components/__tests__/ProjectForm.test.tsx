import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectForm from '../ProjectForm'
import { budgetCategoriesService } from '@/services/budgetCategoriesService'

// Mock the services
vi.mock('@/services/budgetCategoriesService')

const mockCategories = [
  { id: 'cat-1', accountId: 'account-1', name: 'Design Fee', slug: 'design-fee', isArchived: false, metadata: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cat-2', accountId: 'account-1', name: 'Furnishings', slug: 'furnishings', isArchived: false, metadata: null, createdAt: new Date(), updatedAt: new Date() }
]

describe('ProjectForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(budgetCategoriesService.getCategories).mockResolvedValue(mockCategories)
  })

  it('should render project form with category select', async () => {
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Project Name/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Default Budget Category/)).toBeInTheDocument()
    })
  })

  it('should allow selecting a default category', async () => {
    const user = userEvent.setup()
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Default Budget Category/)).toBeInTheDocument()
    })

    const categorySelect = screen.getByLabelText(/Default Budget Category/)
    await user.selectOptions(categorySelect, 'cat-1')
    
    // Verify the form has the selected category
    expect((categorySelect as HTMLSelectElement).value).toBe('cat-1')
  })

  it('should submit form with defaultCategoryId when provided', async () => {
    const user = userEvent.setup()
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Project Name/)).toBeInTheDocument()
    })

    // Fill in required fields
    await user.type(screen.getByLabelText(/Project Name/), 'Test Project')
    await user.type(screen.getByLabelText(/Client Name/), 'Test Client')
    
    // Select a category
    const categorySelect = screen.getByLabelText(/Default Budget Category/)
    await user.selectOptions(categorySelect, 'cat-1')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Create Project/ })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
      const submittedData = mockOnSubmit.mock.calls[0][0]
      expect(submittedData.defaultCategoryId).toBe('cat-1')
      expect(submittedData.name).toBe('Test Project')
      expect(submittedData.clientName).toBe('Test Client')
    })
  })

  it('should pre-populate defaultCategoryId when editing', async () => {
    const initialData = {
      name: 'Existing Project',
      clientName: 'Existing Client',
      defaultCategoryId: 'cat-2'
    }

    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} initialData={initialData} />)
    
    await waitFor(() => {
      const categorySelect = screen.getByLabelText(/Default Budget Category/) as HTMLSelectElement
      expect(categorySelect.value).toBe('cat-2')
    })
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Project Name/)).toBeInTheDocument()
    })

    // Try to submit without required fields
    const submitButton = screen.getByRole('button', { name: /Create Project/ })
    await user.click(submitButton)
    
    // Form should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/Project name is required/)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument()
    })

    const cancelButton = screen.getByRole('button', { name: /Cancel/ })
    await user.click(cancelButton)
    
    expect(mockOnCancel).toHaveBeenCalled()
  })
})

