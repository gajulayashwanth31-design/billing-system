import { useEffect, useState } from 'react'
import { Activity, MessageCircleMore } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Card, DataTable, PageHeader, StatusBadge } from '../components/UI'
import { dateTime } from '../utils/format'

function formatAuditValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export function AuditLogPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [table, setTable] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  useEffect(() => {
    const params = { limit: 100 }
    if (table) params.table = table
    if (from) params.from = from
    if (to) params.to = to
    api.get('/audit-log', { params }).then(({ data }) => setRows(data.data))
      .catch((error) => toast.error(error.userMessage || 'Audit entries could not be loaded.'))
      .finally(() => setLoading(false))
  }, [table, from, to])
  const columns = [
    { key: 'changedAt', label: 'When', value: (row) => dateTime(row.changedAt) },
    { key: 'tableName', label: 'Area' },
    { key: 'recordId', label: 'Record' },
    { key: 'action', label: 'Action', render: (row) => <StatusBadge status={row.action} /> },
    { key: 'changedBy', label: 'Changed by' },
    { key: 'newValue', label: 'Change', render: (row) => {
      const change = formatAuditValue(row.newValue ?? row.oldValue)
      return <span className="audit-value" title={change}>{change}</span>
    } },
  ]
  return <div className="resource-page"><PageHeader title="Audit log" description="A transparent history of important changes in your workspace." action={<span className="log-heading-icon"><Activity size={17} /> Live records</span>} />
    <Card className="data-card"><div className="filter-bar"><label><span>Table</span><input value={table} onChange={(event) => setTable(event.target.value)} placeholder="e.g. products" /></label><label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div><DataTable columns={columns} rows={rows} loading={loading} emptyTitle="No audit entries found" /></Card>
  </div>
}

export function WhatsAppLogPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  useEffect(() => {
    api.get('/whatsapp-messages', { params: { limit: 100, ...(status ? { status } : {}) } })
      .then(({ data }) => setRows(data.data))
      .catch((error) => toast.error(error.userMessage || 'WhatsApp messages could not be loaded.'))
      .finally(() => setLoading(false))
  }, [status])
  const columns = [
    { key: 'invoiceNo', label: 'Invoice' },
    { key: 'toNumber', label: 'Recipient' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'attempts', label: 'Attempts' },
    { key: 'createdAt', label: 'Created', value: (row) => dateTime(row.createdAt) },
    { key: 'error', label: 'Delivery details' },
  ]
  return <div className="resource-page"><PageHeader title="WhatsApp log" description="Track invoice notifications and provider delivery results." action={<span className="log-heading-icon"><MessageCircleMore size={17} /> Delivery status</span>} />
    <Card className="data-card"><div className="filter-bar"><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All messages</option>{['QUEUED', 'SENT', 'DELIVERED', 'FAILED'].map((value) => <option key={value}>{value}</option>)}</select></label></div><DataTable columns={columns} rows={rows} loading={loading} emptyTitle="No WhatsApp messages found" /></Card>
  </div>
}
