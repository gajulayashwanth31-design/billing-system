import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import AdminDashboard from './pages/AdminDashboard'
import InvoiceListPage, { InvoiceDetailPage } from './pages/InvoicePages'
import LoginPage from './pages/LoginPage'
import { AuditLogPage, WhatsAppLogPage } from './pages/LogPages'
import PortalPage from './pages/PortalPage'
import PosPage from './pages/PosPage'
import ResourcePage from './pages/ResourcePage'
import StockPage from './pages/StockPage'
import { homeForRole } from './utils/format'

function ForbiddenPage() {
  return <main className="error-screen"><div className="error-code">403</div><span className="eyebrow">NOT YOUR WORKSPACE</span><h1>That door is closed.</h1><p>Your account doesn't have access to this page.</p><Link className="button button-primary" to="/">Back to your workspace</Link></main>
}

function NotFoundPage() {
  return <main className="error-screen"><div className="error-code">404</div><span className="eyebrow">NOT FOUND</span><h1>We lost that page.</h1><p>It may have moved or the address may be mistyped.</p><Link className="button button-primary" to="/">Go to workspace</Link></main>
}

function IndexRedirect() {
  const { user } = useAuth()
  return <Navigate to={homeForRole(user?.role)} replace />
}

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/403" element={<ForbiddenPage />} />
    <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}><Route element={<Layout />}>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/products" element={<ResourcePage resource="products" />} />
      <Route path="/admin/categories" element={<ResourcePage resource="categories" />} />
      <Route path="/admin/tax-rates" element={<ResourcePage resource="tax-rates" />} />
      <Route path="/admin/discounts" element={<ResourcePage resource="discounts" />} />
      <Route path="/admin/users" element={<ResourcePage resource="users" />} />
      <Route path="/admin/invoices" element={<InvoiceListPage />} />
      <Route path="/admin/invoices/:id" element={<InvoiceDetailPage />} />
      <Route path="/admin/stock" element={<StockPage />} />
      <Route path="/admin/audit-log" element={<AuditLogPage />} />
      <Route path="/admin/whatsapp-log" element={<WhatsAppLogPage />} />
    </Route></Route>
    <Route element={<ProtectedRoute allowedRoles={['CASHIER']} />}><Route element={<Layout />}>
      <Route path="/pos" element={<PosPage />} />
      <Route path="/pos/invoices" element={<InvoiceListPage />} />
      <Route path="/pos/invoices/:id" element={<InvoiceDetailPage />} />
    </Route></Route>
    <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}><Route element={<Layout />}>
      <Route path="/portal" element={<PortalPage />} />
      <Route path="/portal/invoices/:id" element={<InvoiceDetailPage />} />
    </Route></Route>
    <Route path="/" element={<IndexRedirect />} />
    <Route path="/404" element={<NotFoundPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
}

export default function App() {
  return <BrowserRouter><Toaster position="top-right" toastOptions={{ duration: 3600 }} /><AppRoutes /></BrowserRouter>
}
