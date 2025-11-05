import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from './components/layout/Layout'
import LoadingSpinner from './components/ui/LoadingSpinner'
import { ToastProvider } from './components/ui/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { AccountProvider } from './contexts/AccountContext'
import { BusinessProfileProvider } from './contexts/BusinessProfileContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  // No longer initializing anonymous authentication
  // Users must explicitly sign in with Google for security

  return (
    <AuthProvider>
      <AccountProvider>
        <BusinessProfileProvider>
          <ToastProvider>
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                <Routes>
              <Route path="/" element={<Projects />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/item/:id" element={<ItemDetail />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/project/:id/invoice" element={<ProjectInvoice />} />
              <Route path="/project/:id/item/:itemId" element={<ItemDetail />} />
              <Route path="/project/:id/item/add" element={<AddItem />} />
              <Route path="/project/:id/edit-item/:itemId" element={<EditItem />} />
              <Route path="/project/:id/transaction/add" element={<AddTransaction />} />
              <Route path="/project/:id/transaction/:transactionId/edit" element={<EditTransaction />} />
              <Route path="/project/:id/transaction/:transactionId" element={<TransactionDetail />} />

              {/* Business Inventory Routes */}
              <Route path="/business-inventory" element={<BusinessInventory />} />
              <Route path="/business-inventory/add" element={<AddBusinessInventoryItem />} />
              <Route path="/business-inventory/:id" element={<BusinessInventoryItemDetail />} />
              <Route path="/business-inventory/:id/edit" element={<EditBusinessInventoryItem />} />
              <Route path="/business-inventory/transaction/add" element={<AddBusinessInventoryTransaction />} />
              <Route path="/business-inventory/transaction/:transactionId" element={<TransactionDetail />} />
              <Route path="/business-inventory/transaction/:projectId/:transactionId/edit" element={<EditBusinessInventoryTransaction />} />
            </Routes>
            </Suspense>
          </Layout>
        </ProtectedRoute>
      </ToastProvider>
      </BusinessProfileProvider>
      </AccountProvider>
    </AuthProvider>
  )
}

// Lazy load pages for better performance
const Projects = lazy(() => import('./pages/Projects'))
const ItemDetail = lazy(() => import('./pages/ItemDetail'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const ProjectInvoice = lazy(() => import('./pages/ProjectInvoice'))
const AddItem = lazy(() => import('./pages/AddItem'))
const EditItem = lazy(() => import('./pages/EditItem'))
const AddTransaction = lazy(() => import('./pages/AddTransaction'))
const EditTransaction = lazy(() => import('./pages/EditTransaction'))
const TransactionDetail = lazy(() => import('./pages/TransactionDetail'))
const Settings = lazy(() => import('./pages/Settings'))
const BusinessInventory = lazy(() => import('./pages/BusinessInventory'))
const BusinessInventoryItemDetail = lazy(() => import('./pages/BusinessInventoryItemDetail'))
const AddBusinessInventoryItem = lazy(() => import('./pages/AddBusinessInventoryItem'))
const EditBusinessInventoryItem = lazy(() => import('./pages/EditBusinessInventoryItem'))
const AddBusinessInventoryTransaction = lazy(() => import('./pages/AddBusinessInventoryTransaction'))
const EditBusinessInventoryTransaction = lazy(() => import('./pages/EditBusinessInventoryTransaction'))

export default App
