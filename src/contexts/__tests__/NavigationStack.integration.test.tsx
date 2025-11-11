import { render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { NavigationStackProvider } from '@/contexts/NavigationStackContext'
import ContextLink from '@/components/ContextLink'
import { useNavigationContext } from '@/hooks/useNavigationContext'

function TransactionPage() {
  return (
    <div>
      <div>Transaction Page</div>
      <ContextLink to="/item">Go to Item</ContextLink>
    </div>
  )
}

function ItemPage() {
  const { getBackDestination } = useNavigationContext()
  const back = getBackDestination('/fallback')
  return (
    <div>
      <div>Item Page</div>
      <Link to={back} data-testid="back-link">Back</Link>
    </div>
  )
}

describe('Navigation stack integration', () => {
  it('pushes transaction then item and back navigates to transaction', async () => {
    render(
      <NavigationStackProvider>
        <MemoryRouter initialEntries={['/transaction?foo=1']}>
          <Routes>
            <Route path="/transaction" element={<TransactionPage />} />
            <Route path="/item" element={<ItemPage />} />
            <Route path="/fallback" element={<div>Fallback</div>} />
          </Routes>
        </MemoryRouter>
      </NavigationStackProvider>
    )

    // on transaction page, click link to go to item
    fireEvent.click(screen.getByText('Go to Item'))

    // Now on item page; click back
    fireEvent.click(await screen.findByTestId('back-link'))

    // Expect to be back on Transaction Page
    expect(await screen.findByText('Transaction Page')).toBeTruthy()
  })
})


