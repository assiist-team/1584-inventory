import { render, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ContextLink from '@/components/ContextLink'
import { MemoryRouter } from 'react-router-dom'

const mockPush = vi.fn()
vi.mock('@/contexts/NavigationStackContext', () => ({
  useNavigationStack: () => ({ push: mockPush }),
}))

describe('ContextLink', () => {
  afterEach(() => {
    mockPush.mockReset()
  })

  it('calls navigationStack.push with current location on click', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/current?x=1']}>
        <ContextLink to="/target">Go</ContextLink>
      </MemoryRouter>
    )

    fireEvent.click(getByText('Go'))
    expect(mockPush).toHaveBeenCalledWith('/current?x=1')
  })
})


