import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, LockKeyhole, ReceiptText, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { Button, FormField } from '../components/UI'
import { homeForRole } from '../utils/format'

const demoAccounts = [
  { label: 'Admin', username: 'admin', password: 'Admin@123', role: 'ADMIN', icon: ShieldCheck },
  { label: 'Cashier', username: 'cashier1', password: 'Cashier@123', role: 'CASHIER', icon: BadgeCheck },
  { label: 'Customer', username: 'priya', password: 'Customer@123', role: 'CUSTOMER', icon: UserRound },
]
const currentYear = new Date().getFullYear()

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (user) return <Navigate to={homeForRole(user.role)} replace />

  async function submit(values = { username, password }) {
    setBusy(true)
    setError('')
    try {
      const current = await login(values.username, values.password)
      toast.success(`Welcome back, ${current.username}`)
      navigate(homeForRole(current.role), { replace: true })
    } catch (requestError) {
      const message = requestError.userMessage || 'Unable to sign in. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-screen">
      <div className="login-decoration decoration-one" />
      <div className="login-decoration decoration-two" />
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <ReceiptText size={20} />
          </span>
          <span>
            ledger<span className="brand-light">line</span>
          </span>
          <span className="login-tag">BILLING SUITE</span>
        </div>
        <div className="login-heading">
          <span className="eyebrow">
            <Sparkles size={14} /> YOUR BUSINESS, IN BALANCE
          </span>
          <h1>Welcome back.</h1>
          <p>Sign in to your workspace to continue.</p>
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <FormField label="Username" error={error && undefined}>
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
            />
          </FormField>
          <FormField label="Password">
            <div className="password-wrap">
              <LockKeyhole size={17} />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </FormField>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="login-submit">
            {busy ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={17} />
          </Button>
        </form>
        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <div className="demo-section">
            <div className="demo-divider">
              <span>QUICK DEMO ACCESS</span>
            </div>
            <div className="demo-grid">
              {demoAccounts.map(({ label, icon: Icon, ...account }) => (
                <button
                  key={label}
                  className="demo-button"
                  disabled={busy}
                  onClick={() => {
                    setUsername(account.username)
                    setPassword(account.password)
                    submit(account)
                  }}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
            <p>Sample accounts are enabled for demonstration.</p>
          </div>
        )}
        <div className="login-footer">
          <span>Protected workspace</span>
          <span>
            <ShieldCheck size={14} /> Secure sign-in
          </span>
        </div>
      </section>
      <p className="login-copyright">© {currentYear} Ledgerline · Billing made clear.</p>
    </main>
  )
}
