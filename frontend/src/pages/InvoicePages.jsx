import { useEffect, useState } from 'react'
import { ArrowLeft, Ban, Download, Eye, Printer, Search } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Button, Card, DataTable, FormField, Modal, PageHeader, Skeleton, StatusBadge } from '../components/UI'
import { dateTime, money } from '../utils/format'
import { useAuth } from '../context/AuthContext'

const currentDay = new Date().toLocaleDateString('en-CA')

export default function InvoiceListPage() {
  const { role } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState(role === 'CASHIER' ? currentDay : '')
  const [to, setTo] = useState(role === 'CASHIER' ? currentDay : '')
  const [cashiers, setCashiers] = useState([])
  const [cashierId, setCashierId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (role !== 'ADMIN') return
    api.get('/users', { params: { limit: 100 } })
      .then(({ data }) => setCashiers(data.data.filter((user) => user.role === 'CASHIER')))
      .catch((error) => toast.error(error.userMessage || 'Cashier list could not be loaded.'))
  }, [role])

  useEffect(() => {
    setLoading(true)
    const params = { limit: 100, page, sort: 'created_at', direction: 'desc' }
    if (status) params.status = status
    if (from) params.from = from
    if (to) params.to = to
    if (cashierId) params.cashierId = cashierId
    api.get('/invoices', { params }).then(({ data }) => {
      setRows(data.data)
      setTotal(Number(data.pagination.total))
    }).catch((error) => toast.error(error.userMessage || 'Invoices could not be loaded.'))
      .finally(() => setLoading(false))
  }, [status, from, to, cashierId, page])

  const columns = [
    { key: 'invoiceNo', label: 'Invoice', render: (row) => <strong className="invoice-number">{row.invoiceNo}</strong> },
    { key: 'customerName', label: 'Customer' },
    ...(role === 'ADMIN' ? [{ key: 'cashierUsername', label: 'Cashier' }] : []),
    { key: 'createdAt', label: 'Date', value: (row) => dateTime(row.createdAt) },
    { key: 'grandTotal', label: 'Total', render: (row) => money(row.grandTotal) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return <div className="resource-page"><PageHeader title={role === 'ADMIN' ? 'Invoices' : "Today's invoices"} description={role === 'ADMIN' ? 'Review, filter, and manage every invoice.' : 'A clear view of your recent customer bills.'} />
    <Card className="data-card"><div className="filter-bar"><label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{['DRAFT', 'FINALIZED', 'PAID', 'VOID'].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>From</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /></label><label><span>To</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></label>{role === 'ADMIN' && <label><span>Cashier</span><select value={cashierId} onChange={(event) => { setCashierId(event.target.value); setPage(1) }}><option value="">All cashiers</option>{cashiers.map((cashier) => <option value={cashier.id} key={cashier.id}>{cashier.username}</option>)}</select></label>}<span className="filter-results"><Search size={15} /> {total} invoices</span></div>
      <DataTable columns={columns} rows={rows} loading={loading} emptyTitle="No invoices match these filters" actions={(row) => <button className="small-icon-button" title="View invoice" onClick={() => navigate(`${role === 'ADMIN' ? '/admin' : '/pos'}/invoices/${row.id}`)}><Eye size={16} /></button>} />
      {total > 100 && <div className="server-pagination"><span>Page {page} · {total} total</span><div><Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="ghost" disabled={page * 100 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
    </Card>
  </div>
}

export function InvoiceDetailPage() {
  const { id } = useParams()
  const { role } = useAuth()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [voidReason, setVoidReason] = useState('')
  const [voidDialog, setVoidDialog] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const endpoint = role === 'CUSTOMER' ? `/me/invoices/${id}` : `/invoices/${id}`
      const { data } = await api.get(endpoint)
      setInvoice(data.data)
    } catch (error) { toast.error(error.userMessage || 'Invoice could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id, role])

  async function voidInvoice() {
    if (!voidReason.trim()) return toast.error('Enter a reason before voiding this invoice.')
    setBusy(true)
    try {
      const { data } = await api.post(`/invoices/${id}/void`, { reason: voidReason.trim() })
      setInvoice(data.data)
      setVoidDialog(false)
      toast.success('Invoice voided. The audit log has been updated.')
    } catch (error) { toast.error(error.userMessage || 'Invoice could not be voided.') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="invoice-detail-page"><Skeleton rows={5} /></div>
  if (!invoice) return <div className="invoice-detail-page"><Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</Button><Card className="empty-invoice"><h2>Invoice unavailable</h2><p>It may have been removed or you may not have permission to view it.</p></Card></div>

  return <div className="invoice-detail-page"><PageHeader title={invoice.invoiceNo} description={`Created ${dateTime(invoice.createdAt)}${invoice.cashierUsername ? ` · by ${invoice.cashierUsername}` : ''}`} action={<div className="detail-actions"><Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button><Button variant="secondary" title="PDF downloads arrive in Phase 4" disabled><Download size={16} /> Download PDF</Button>{role === 'ADMIN' && invoice.status !== 'VOID' && <Button variant="danger" onClick={() => setVoidDialog(true)}><Ban size={16} /> Void invoice</Button>}</div>} />
    <div className="invoice-detail-grid"><div className="invoice-main-column"><Card className="invoice-info-card"><div className="invoice-card-heading"><div><span className="eyebrow">BILL TO</span><h2>{invoice.customerName}</h2><p>{invoice.customerPhone}</p></div><StatusBadge status={invoice.status} /></div><div className="invoice-number-strip"><span>Invoice number</span><strong>{invoice.invoiceNo}</strong></div>
      <div className="invoice-items-table"><div className="invoice-item-head"><span>Item</span><span>Qty</span><span>Price</span><span>Tax</span><span>Total</span></div>{invoice.items.map((item) => <div className="invoice-item-row" key={item.id}><span><strong>{item.productName}</strong><small>{item.taxRate}% tax</small></span><span>{item.quantity}</span><span>{money(item.unitPrice)}</span><span>{money(item.lineTax)}</span><strong>{money(item.lineTotal)}</strong></div>)}</div>
      <div className="invoice-totals"><div><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></div><div><span>Tax</span><strong>{money(invoice.tax)}</strong></div><div><span>Discount</span><strong>− {money(invoice.discountAmount)}</strong></div><div className="invoice-grand"><span>Grand total</span><strong>{money(invoice.grandTotal)}</strong></div><div><span>Paid</span><strong>{money(invoice.paidAmount)}</strong></div>{Number(invoice.balance) > 0 && <div><span>Balance due</span><strong className="balance-due">{money(invoice.balance)}</strong></div>}</div>
    </Card>
    <Card className="payments-card"><div className="section-card-title"><span className="eyebrow">PAYMENT HISTORY</span><h2>Payments</h2></div>{invoice.payments.length ? invoice.payments.map((payment) => <div className="payment-history-row" key={payment.id}><span className="payment-dot" /><span><strong>{payment.method}</strong><small>{dateTime(payment.paidAt)}</small></span><strong>{money(payment.amount)}</strong></div>) : <p className="subtle-empty">No payments have been recorded.</p>}</Card></div>
      <aside className="invoice-side-column"><Card className="customer-summary-card"><span className="eyebrow">CUSTOMER</span><div className="detail-customer-avatar">{invoice.customerName.slice(0, 1).toUpperCase()}</div><h2>{invoice.customerName}</h2><p>{invoice.customerPhone}</p><div className="side-divider" /><div className="side-detail"><span>WhatsApp delivery</span><StatusBadge status={invoice.whatsapp?.status || 'QUEUED'} /></div><p className="whatsapp-note">{invoice.whatsapp?.error || 'Delivery receipt will appear here when the notification service processes it.'}</p></Card>
        <Button variant="ghost" className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back to invoices</Button>
      </aside></div>
    {voidDialog && <Modal title="Void this invoice?" onClose={() => setVoidDialog(false)}><div className="modal-content"><p className="dialog-copy">This will reverse the bill and restore stock. The action will be recorded in the audit log.</p><FormField label="Reason for voiding"><textarea rows="3" required value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Add a clear reason…" /></FormField></div><footer className="modal-footer"><Button variant="ghost" onClick={() => setVoidDialog(false)}>Cancel</Button><Button variant="danger" disabled={busy || !voidReason.trim()} onClick={voidInvoice}>{busy ? 'Voiding…' : 'Void invoice'}</Button></footer></Modal>}
  </div>
}
