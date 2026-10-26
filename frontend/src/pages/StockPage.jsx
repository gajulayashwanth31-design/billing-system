import { useEffect, useState } from 'react'
import { Boxes, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Button, DataTable, FormField, Modal, PageHeader, StatusBadge } from '../components/UI'

export default function StockPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState(false)
  const [lowStock, setLowStock] = useState([])

  async function load() {
    try {
      const [stockResponse, lowResponse] = await Promise.all([
        api.get('/stock', { params: { limit: 100, sort: 'quantity' } }),
        api.get('/reports/low-stock', { params: { limit: 100 } }),
      ])
      setRows(stockResponse.data.data)
      setLowStock(lowResponse.data.data)
    } catch (error) { toast.error(error.userMessage || 'Stock information could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.put(`/stock/${record.productId}`, { quantity: Number(quantity) })
      toast.success('Stock level updated. The change is in the audit log.')
      setRecord(null)
      await load()
    } catch (error) { toast.error(error.userMessage || 'Stock could not be adjusted.') }
    finally { setBusy(false) }
  }

  const columns = [
    { key: 'sku', label: 'SKU', render: (row) => <span className="sku-value">{row.sku}</span> },
    { key: 'name', label: 'Product' },
    { key: 'quantity', label: 'On hand', render: (row) => <strong className={Number(row.quantity) <= Number(row.reorder_level) ? 'stock-cell-low' : ''}>{row.quantity} <small>units</small></strong> },
    { key: 'reorderLevel', label: 'Reorder at' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={Number(row.quantity) <= Number(row.reorderLevel) ? 'LOW STOCK' : 'HEALTHY'} /> },
  ]
  return <div className="resource-page"><PageHeader title="Stock control" description="Keep the shelves ready. Inventory changes are recorded for you." action={<span className="stock-summary"><Boxes size={16} /> {lowStock.length} need attention</span>} />
    <div className="stock-callout"><span className="stock-callout-icon"><Boxes size={17} /></span><span><strong>Stock adjustments are audited</strong><small>Every adjustment records who changed the quantity and when.</small></span>{lowStock.length > 0 && <span className="stock-callout-count">{lowStock.length} low</span>}</div>
    <section className="card data-card"><DataTable columns={columns} rows={rows} loading={loading} emptyTitle="No stock records found" actions={(row) => <button className="small-icon-button" title="Adjust quantity" onClick={() => { setRecord(row); setQuantity(row.quantity) }}><Pencil size={15} /></button>} /></section>
    {record && <Modal title={`Adjust stock · ${record.name}`} onClose={() => setRecord(null)}><form onSubmit={save}><div className="modal-content"><p className="dialog-copy">Current stock: <strong>{record.quantity}</strong> units · Reorder level: {record.reorderLevel}</p><FormField label="New quantity"><input type="number" min="0" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></FormField></div><footer className="modal-footer"><Button type="button" variant="ghost" onClick={() => setRecord(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save quantity'}</Button></footer></form></Modal>}
  </div>
}
