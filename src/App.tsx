import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from './components/layout/Layout'
import LoadingSpinner from './components/ui/LoadingSpinner'
import { ToastProvider } from './components/ui/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  // No longer initializing anonymous authentication
  // Users must explicitly sign in with Google for security

  return (
    <AuthProvider>
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
              <Route path="/project/:id/item/:itemId" element={<ItemDetail />} />
              <Route path="/project/:id/item/add" element={<AddItem />} />
              <Route path="/project/:id/edit-item/:itemId" element={<EditItem />} />
              <Route path="/project/:id/transaction/add" element={<AddTransaction />} />
              <Route path="/project/:id/transaction/:transactionId/edit" element={<EditTransaction />} />
              <Route path="/project/:id/transaction/:transactionId" element={<TransactionDetail />} />
            </Routes>
            </Suspense>
          </Layout>
        </ProtectedRoute>
      </ToastProvider>
    </AuthProvider>
  )
}

// Lazy load pages for better performance
const Projects = lazy(() => import('./pages/Projects'))
const ItemDetail = lazy(() => import('./pages/ItemDetail'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const AddItem = lazy(() => import('./pages/AddItem'))
const EditItem = lazy(() => import('./pages/EditItem'))
const AddTransaction = lazy(() => import('./pages/AddTransaction'))
const EditTransaction = lazy(() => import('./pages/EditTransaction'))
const TransactionDetail = lazy(() => import('./pages/TransactionDetail'))
const Settings = lazy(() => import('./pages/Settings'))

export default App
