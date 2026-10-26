import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity, Boxes, CircleHelp, FileText, LayoutDashboard,
  LogOut, Menu, Moon, Package, Percent, ReceiptText, Settings2, Sun, Tags, Users, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { homeForRole } from '../utils/format'

const links = {
  ADMIN: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/products', label: 'Products', icon: Package },
    { to: '/admin/categories', label: 'Categories', icon: Tags },
    { to: '/admin/tax-rates', label: 'Tax rates', icon: Settings2 },
    { to: '/admin/discounts', label: 'Discounts', icon: Percent },
    { to: '/admin/users', label: 'Team & users', icon: Users },
    { to: '/admin/invoices', label: 'Invoices', icon: FileText },
    { to: '/admin/stock', label: 'Stock control', icon: Boxes },
    { to: '/admin/audit-log', label: 'Audit log', icon: Activity },
    { to: '/admin/whatsapp-log', label: 'WhatsApp log', icon: ReceiptText },
  ],
  CASHIER: [{ to: '/pos', label: 'Point of sale', icon: ReceiptText, end: true }, { to: '/pos/invoices', label: "Today's invoices", icon: FileText }],
  CUSTOMER: [{ to: '/portal', label: 'My account', icon: LayoutDashboard, end: true }],
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const roleLinks = links[user?.role] || []

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><ReceiptText size={20} /></span><span>ledger<span className="brand-light">line</span><small>BILLING SUITE</small></span><button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{roleLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={17} /><div><strong>Need a hand?</strong><span>Ask your administrator</span></div></div><div className="profile-row"><div className="avatar">{user?.username?.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user?.username}</strong><span>{user?.role?.toLowerCase()}</span></div><button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></div></div>
    </aside>
    <main className="main-shell"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{user?.role === 'ADMIN' ? 'Administration' : user?.role === 'CASHIER' ? 'Point of sale' : 'Customer portal'}</strong></div><div className="topbar-actions"><button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></button><button className="top-avatar" onClick={() => navigate(homeForRole(user?.role))}>{user?.username?.slice(0, 1).toUpperCase()}</button><span className="top-user">{user?.username}</span><button className="icon-button signout-mobile" title="Sign out" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button></div></header><div className="page-content"><Outlet /></div></main>
  </div>
}
