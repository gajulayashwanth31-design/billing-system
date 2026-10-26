import { useState } from 'react'
import { Database, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Button, Card, PageHeader } from '../components/UI'

const actions = [
  { value: 'select_products', label: 'SELECT products' },
  { value: 'update_product_price', label: 'UPDATE product price' },
  { value: 'delete_product', label: 'DELETE a product' },
  { value: 'insert_invoice', label: 'INSERT an invoice' },
  { value: 'select_audit_log', label: 'SELECT audit_log' },
]
const roles = ['CUSTOMER', 'CASHIER', 'ADMIN']

export default function DbPermissionsPage() {
  const [action, setAction] = useState('delete_product')
  const [role, setRole] = useState('CASHIER')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function runAction() {
    setBusy(true)
    try {
      const { data } = await api.post('/demo/db-permissions', { action, role })
      setResult(data.data)
    } catch (error) {
      toast.error(error.userMessage || 'The database permission action could not run.')
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const selectedAction = actions.find((item) => item.value === action)
  return <div className="resource-page">
    <PageHeader title="Database permissions demo" description="Run fixed, safe examples against each MySQL role pool." action={<span className="log-heading-icon"><Database size={17} /> DEMO MODE</span>} />
    <Card className="permissions-demo-card">
      <div className="permissions-demo-controls">
        <label><span>Sample action</span><select value={action} onChange={(event) => { setAction(event.target.value); setResult(null) }}>{actions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label><span>Run as</span><select value={role} onChange={(event) => { setRole(event.target.value); setResult(null) }}>{roles.map((value) => <option key={value}>{value}</option>)}</select></label>
        <Button disabled={busy} onClick={runAction}><Play size={15} /> {busy ? 'Running…' : 'Run sample'}</Button>
      </div>
      <p className="permissions-demo-note">Only predefined operations can run. Each database transaction is rolled back before the result is returned.</p>
      <div className="table-scroll"><table className="permissions-result-table"><thead><tr><th>Role pool</th><th>Sample action</th><th>MySQL result</th><th>Persistence</th></tr></thead><tbody>
        {result ? <tr><td><strong>{result.role}</strong></td><td>{selectedAction?.label}</td><td><span className={result.allowed ? 'permission-allowed' : 'permission-denied'}>{result.allowed ? JSON.stringify(result.result) : result.error}</span></td><td>{result.rolledBack ? 'Rolled back' : 'Not run'}</td></tr> : <tr><td colSpan="4" className="permissions-empty">Choose a sample and run it to see the database's actual result.</td></tr>}
      </tbody></table></div>
    </Card>
  </div>
}
