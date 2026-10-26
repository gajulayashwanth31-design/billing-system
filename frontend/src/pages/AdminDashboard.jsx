import { useEffect, useState } from 'react'
import { Activity, ArrowRight, Boxes, CircleDollarSign, Download, FileCheck2, Package, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Button, Card, PageHeader, Skeleton, StatCard } from '../components/UI'
import { dateOnly, money } from '../utils/format'

const chartColors = ['#3e755e', '#d5a34b', '#7a8c79', '#d1775f', '#6e7894']
const reportDate = new Date()

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null)
  const [sales, setSales] = useState([])
  const [categories, setCategories] = useState([])
  const [payments, setPayments] = useState([])
  const [products, setProducts] = useState([])
  const [cashiers, setCashiers] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/reports/sales-by-day', { params: { limit: 14 } }),
      api.get('/reports/sales-by-category'),
      api.get('/reports/payment-split'),
      api.get('/reports/top-products', { params: { limit: 5 } }),
      api.get('/reports/top-cashiers', { params: { limit: 5 } }),
      api.get('/reports/low-stock', { params: { limit: 100 } }),
    ]).then(([a, b, c, d, e, f, g]) => {
      setSummary(a.data.data)
      setSales([...b.data.data].reverse().map((row) => ({ ...row, day: dateOnly(row.sale_date) })))
      setCategories(c.data.data)
      setPayments(d.data.data)
      setProducts(e.data.data)
      setCashiers(f.data.data)
      setLowStock(g.data.data)
    }).catch((error) => toast.error(error.userMessage || 'Dashboard data could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])

  function downloadReorderCsv() {
    const columns = ['SKU', 'Product', 'Quantity', 'Reorder level']
    const escapeCell = (value) => {
      let text = String(value ?? '')
      if (/^\s*[=+\-@]/.test(text)) text = `'${text}`
      return `"${text.replaceAll('"', '""')}"`
    }
    const rows = lowStock.map((item) => [item.sku, item.name, item.quantity, item.reorder_level])
    const csv = [columns, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')
    const objectUrl = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'low-stock-reorder-list.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
  }

  return <div className="dashboard-page">
    <PageHeader title="Good morning." description="Here's what's happening across your store today." action={<span className="date-pill"><Activity size={15} /> {reportDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>} />
    {loading ? <Skeleton rows={6} /> : summary && <>
      {lowStock.length > 0 && <Card className="low-stock-banner"><div><span className="eyebrow">INVENTORY ALERT</span><strong>{lowStock.length} product{lowStock.length === 1 ? '' : 's'} need restocking</strong><span>Review stock levels and prepare a reorder.</span></div><Button variant="secondary" onClick={downloadReorderCsv}><Download size={15} /> Download reorder list (CSV)</Button></Card>}
      <div className="stats-grid">
        <StatCard label="Today's sales" value={money(summary.todaySales)} detail="Paid invoices today" icon={CircleDollarSign} tone="mint" />
        <StatCard label="Invoices today" value={summary.invoicesToday} detail={summary.topCashier ? `Top cashier: ${summary.topCashier.username}` : 'No sales recorded yet'} icon={FileCheck2} tone="sand" />
        <StatCard label="Low stock alerts" value={summary.lowStockCount} detail="Products at or below reorder level" icon={Boxes} tone="rose" />
        <StatCard label="Top cashier" value={summary.topCashier?.username || '—'} detail={summary.topCashier ? `${summary.topCashier.invoiceCount} paid invoices today` : 'No paid invoices yet'} icon={UserRound} tone="blue" />
      </div>
      <div className="chart-grid dashboard-charts">
        <Card className="chart-card chart-wide"><div className="chart-heading"><div><span className="eyebrow">PERFORMANCE</span><h2>Sales over time</h2></div><span className="chart-legend"><i /> Revenue</span></div>
          {sales.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={sales} margin={{ top: 8, right: 8, bottom: 0, left: 2 }}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(value) => `₹${value}`} /><Tooltip formatter={(value) => money(value)} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 12 }} /><Line type="monotone" dataKey="sales_total" stroke="#3e755e" strokeWidth={3} dot={{ r: 3, fill: '#3e755e', strokeWidth: 0 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <div className="chart-empty">Sales will appear once invoices are paid.</div>}
        </Card>
        <Card className="chart-card"><div className="chart-heading"><div><span className="eyebrow">PAYMENT MIX</span><h2>How customers pay</h2></div></div>
          {payments.length ? <><div className="donut-area"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={payments} dataKey="amount" nameKey="method" innerRadius={56} outerRadius={82} paddingAngle={4} stroke="none">{payments.map((entry, index) => <Cell key={entry.method} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => money(value)} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 12 }} /></PieChart></ResponsiveContainer><div className="donut-center"><span>PAID</span><strong>{payments.reduce((sum, row) => sum + Number(row.paymentCount), 0)}</strong><small>payments</small></div></div><div className="chart-legend-list">{payments.map((payment, index) => <div key={payment.method}><span><i style={{ background: chartColors[index % chartColors.length] }} />{payment.method}</span><strong>{money(payment.amount)}</strong></div>)}</div></> : <div className="chart-empty">Payment data will appear here.</div>}
        </Card>
        <Card className="chart-card"><div className="chart-heading"><div><span className="eyebrow">BEST SELLERS</span><h2>Top products</h2></div><Link className="text-link" to="/admin/products">Products <ArrowRight size={14} /></Link></div>
          {products.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={products} layout="vertical" margin={{ top: 5, right: 8, bottom: 0, left: 2 }}><CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="var(--border)" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip formatter={(value) => `${value} units`} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 12 }} /><Bar dataKey="units_sold" fill="#d5a34b" radius={[0, 5, 5, 0]} barSize={13} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty">Product rankings appear once sales are made.</div>}
        </Card>
        <Card className="chart-card"><div className="chart-heading"><div><span className="eyebrow">BY CATEGORY</span><h2>Category sales</h2></div></div>
          {categories.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={categories} margin={{ top: 5, right: 6, bottom: 4, left: -16 }}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" /><XAxis dataKey="category_name" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value) => `₹${value}`} /><Tooltip formatter={(value) => money(value)} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 12 }} /><Bar dataKey="sales_total" fill="#7a8c79" radius={[5, 5, 0, 0]} barSize={28} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty">Category sales appear once sales are made.</div>}
        </Card>
      </div>
      <div className="bottom-grid"><Card className="list-card"><div className="list-card-heading"><div><span className="eyebrow">INVENTORY</span><h2>Needs attention</h2></div><Link to="/admin/stock" className="text-link">Manage stock <ArrowRight size={14} /></Link></div>{lowStock.length ? lowStock.map((item) => <div className="stock-alert-row" key={item.product_id}><span className="alert-product-icon"><Package size={16} /></span><span className="alert-product"><strong>{item.name}</strong><small>{item.sku}</small></span><span className="stock-number">{item.quantity} left</span><span className="reorder-level">of {item.reorder_level}</span></div>) : <div className="all-good"><span>✓</span> Stock levels look healthy.</div>}</Card>
        <Card className="list-card"><div className="list-card-heading"><div><span className="eyebrow">TEAM</span><h2>Top cashiers</h2></div><Link to="/admin/users" className="text-link">View team <ArrowRight size={14} /></Link></div>{cashiers.length ? cashiers.map((cashier, index) => <div className="cashier-row" key={cashier.cashierId}><span className={`rank-badge rank-${index + 1}`}>{index + 1}</span><span className="cashier-name">{cashier.username}</span><span className="cashier-invoices">{cashier.invoiceCount} bills</span><strong>{money(cashier.salesTotal)}</strong></div>) : <div className="all-good">Sales rankings will appear here.</div>}</Card></div>
    </>}
  </div>
}
