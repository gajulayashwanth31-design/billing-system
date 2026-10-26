import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Button, ConfirmDialog, DataTable, FormField, Modal, PageHeader, StatusBadge } from '../components/UI'
import { dateOnly, money } from '../utils/format'

const field = (name, label, options = {}) => ({ name, label, ...options })
const resources = {
  products: {
    title: 'Products', endpoint: '/products', columns: [
      { key: 'sku', label: 'SKU', render: (row) => <span className="sku-value">{row.sku}</span> },
      { key: 'name', label: 'Product' }, { key: 'category_name', label: 'Category' },
      { key: 'price', label: 'Price', render: (row) => money(row.price) },
      { key: 'stock_quantity', label: 'Available', render: (row) => <span className={Number(row.stock_quantity) <= Number(row.reorder_level) ? 'stock-cell-low' : ''}>{row.stock_quantity} <small>units</small></span> },
      { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} /> },
    ], fields: [
      field('sku', 'SKU', { required: true, maxLength: 50 }), field('name', 'Product name', { required: true, maxLength: 180 }),
      field('categoryId', 'Category', { type: 'select', optionsKey: 'categories', optionLabel: 'name', required: true }),
      field('taxId', 'Tax rate', { type: 'select', optionsKey: 'taxes', optionLabel: 'name', required: true }),
      field('price', 'Price (₹)', { type: 'number', min: 0, step: '0.01', required: true }),
      field('reorderLevel', 'Reorder level', { type: 'number', min: 0, step: 1, required: true }),
      field('initialStock', 'Opening stock', { type: 'number', min: 0, step: 1, required: true, createOnly: true }),
      field('isActive', 'Active product', { type: 'checkbox', defaultValue: true }),
    ],
  },
  categories: {
    title: 'Categories', endpoint: '/categories',
    columns: [{ key: 'name', label: 'Category' }, { key: 'created_at', label: 'Created', value: (row) => dateOnly(row.created_at) }],
    fields: [field('name', 'Category name', { required: true, maxLength: 100 })],
  },
  'tax-rates': {
    title: 'Tax rates', endpoint: '/tax-rates',
    columns: [{ key: 'name', label: 'Tax name' }, { key: 'rate_percent', label: 'Rate', render: (row) => `${row.rate_percent}%` }],
    fields: [field('name', 'Tax name', { required: true, maxLength: 50 }), field('ratePercent', 'Rate (%)', { type: 'number', min: 0, max: 100, step: '0.01', required: true })],
  },
  discounts: {
    title: 'Discounts', endpoint: '/discounts',
    columns: [{ key: 'code', label: 'Code' }, { key: 'type', label: 'Type' }, { key: 'value', label: 'Value', render: (row) => row.type === 'PERCENT' ? `${row.value}%` : money(row.value) }, { key: 'valid_from', label: 'Starts', value: (row) => dateOnly(row.valid_from) }, { key: 'valid_to', label: 'Ends', value: (row) => dateOnly(row.valid_to) }, { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} /> }],
    fields: [field('code', 'Discount code', { required: true, maxLength: 40 }), field('type', 'Discount type', { type: 'select', options: [{ value: 'PERCENT', label: 'Percentage' }, { value: 'FLAT', label: 'Fixed amount' }], required: true }), field('value', 'Value', { type: 'number', min: 0.01, step: '0.01', required: true }), field('validFrom', 'Valid from', { type: 'datetime-local', required: true }), field('validTo', 'Valid until', { type: 'datetime-local', required: true }), field('minBillAmount', 'Minimum bill (₹)', { type: 'number', min: 0, step: '0.01', required: true }), field('isActive', 'Active discount', { type: 'checkbox', defaultValue: true })],
  },
  users: {
    title: 'Team & users', endpoint: '/users',
    columns: [{ key: 'username', label: 'Username' }, { key: 'role', label: 'Role' }, { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} /> }, { key: 'created_at', label: 'Added', value: (row) => dateOnly(row.created_at) }],
    fields: [field('username', 'Username', { required: true, minLength: 3, maxLength: 80 }), field('password', 'Password', { type: 'password', required: true, minLength: 8, hint: 'Use upper/lowercase letters and a number.', createOnly: true }), field('role', 'Role', { type: 'select', options: ['ADMIN', 'CASHIER', 'CUSTOMER'].map((value) => ({ value, label: value })), required: true, createOnly: true }), field('customerId', 'Link customer profile', { type: 'select', optionsKey: 'customers', optionLabel: 'name', conditional: (values) => values.role === 'CUSTOMER', required: true, createOnly: true }), field('isActive', 'Active account', { type: 'checkbox', defaultValue: true, createOnly: true })],
  },
}

function defaultValues(config, record) {
  const values = {}
  for (const item of config.fields) {
    if (record) {
      const keyMap = { categoryId: 'category_id', taxId: 'tax_id', ratePercent: 'rate_percent', validFrom: 'valid_from', validTo: 'valid_to', minBillAmount: 'min_bill_amount', isActive: 'is_active', customerId: 'customer_id', initialStock: 'stock_quantity' }
      let value = record[item.name] ?? record[keyMap[item.name]]
      if (item.name === 'validFrom' || item.name === 'validTo') value = value ? new Date(value).toISOString().slice(0, 16) : ''
      if (value !== undefined && value !== null) values[item.name] = value
      else if (item.type === 'checkbox') values[item.name] = false
    } else if (item.defaultValue !== undefined) values[item.name] = item.defaultValue
    else values[item.name] = ''
  }
  return values
}

export default function ResourcePage({ resource }) {
  const config = resources[resource]
  const singular = { products: 'product', categories: 'category', 'tax-rates': 'tax rate', discounts: 'discount', users: 'user' }[resource]
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState({})
  const [modal, setModal] = useState(null)
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const visibleFields = config.fields

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(config.endpoint, { params: { limit: 100 } })
      setRows(data.data)
    } catch (error) {
      toast.error(error.userMessage || `${config.title} could not be loaded.`)
    } finally {
      setLoading(false)
    }
  }, [config])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const needs = config.fields.some((item) => item.optionsKey)
    if (!needs) return
    const requests = {}
    if (config.fields.some((item) => item.optionsKey === 'categories')) requests.categories = api.get('/categories', { params: { limit: 100 } })
    if (config.fields.some((item) => item.optionsKey === 'taxes')) requests.taxes = api.get('/tax-rates', { params: { limit: 100 } })
    if (config.fields.some((item) => item.optionsKey === 'customers')) requests.customers = api.get('/customers', { params: { limit: 100 } })
    Promise.all(Object.entries(requests).map(async ([key, request]) => [key, (await request).data.data]))
      .then((result) => setOptions(Object.fromEntries(result)))
      .catch((error) => toast.error(error.userMessage || 'Form options could not be loaded.'))
  }, [config])

  function openCreate() { setValues(defaultValues(config)); setModal({ mode: 'create' }) }
  function openEdit(row) { setValues(defaultValues(config, row)); setModal({ mode: 'edit', row }) }

  function buildPayload() {
    const payload = { ...values }
    for (const item of visibleFields) {
      if (item.createOnly && modal.mode === 'edit') delete payload[item.name]
      if (item.type === 'number' && payload[item.name] !== '') payload[item.name] = Number(payload[item.name])
      if (item.type === 'datetime-local' && payload[item.name]) payload[item.name] = new Date(payload[item.name]).toISOString()
      if (item.type === 'select' && payload[item.name] !== '') payload[item.name] = Number(payload[item.name])
    }
    if (resource === 'users' && modal.mode === 'edit') {
      return { username: payload.username, isActive: modal.row.is_active }
    }
    if (resource === 'products' && modal.mode === 'edit') delete payload.initialStock
    return payload
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = buildPayload()
      if (modal.mode === 'create') await api.post(config.endpoint, payload)
      else await api.put(`${config.endpoint}/${modal.row.id}`, payload)
      toast.success(`${singular} ${modal.mode === 'create' ? 'added' : 'updated'}.`)
      setModal(null)
      await load()
    } catch (error) {
      toast.error(error.userMessage || 'The record could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(row) {
    try {
      await api.delete(`${config.endpoint}/${row.id}`)
      toast.success(`${singular} removed.`)
      setConfirm(null)
      await load()
    } catch (error) {
      toast.error(error.userMessage || 'The record could not be removed.')
      setConfirm(null)
    }
  }

  async function toggleActive(row) {
    try {
      await api.post(`/users/${row.id}/${row.is_active ? 'deactivate' : 'activate'}`)
      toast.success(`Account ${row.is_active ? 'deactivated' : 'activated'}.`)
      await load()
    } catch (error) { toast.error(error.userMessage || 'Account status could not be changed.') }
  }

  async function resetPassword(row) {
    const password = window.prompt(`Enter a temporary password for ${row.username}. It must contain upper/lowercase letters and a number.`)
    if (password === null) return
    try {
      await api.post(`/users/${row.id}/reset-password`, { password })
      toast.success('Password reset.')
    } catch (error) { toast.error(error.userMessage || 'Password could not be reset.') }
  }

  const actions = (row) => <div className="table-action-group">{resource === 'users' ? <>
    <button className="small-icon-button" title={row.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(row)}><Power size={15} /></button><button className="small-icon-button" title="Reset password" onClick={() => resetPassword(row)}><KeyRound size={15} /></button>
  </> : <><button className="small-icon-button" title="Edit" onClick={() => openEdit(row)}><Pencil size={15} /></button><button className="small-icon-button danger-icon" title="Delete" onClick={() => setConfirm(row)}><Trash2 size={15} /></button></>}</div>

  return <div className="resource-page"><PageHeader title={config.title} description={resource === 'products' ? 'Manage the items your customers love.' : `Keep your ${config.title.toLowerCase()} organized and up to date.`} action={<Button onClick={openCreate}><Plus size={17} /> Add {singular}</Button>} />
    <section className="card data-card"><DataTable columns={config.columns} rows={rows} loading={loading} actions={actions} emptyTitle={`No ${config.title.toLowerCase()} found`} /></section>
    {modal && <Modal title={`${modal.mode === 'create' ? 'Add' : 'Edit'} ${singular}`} onClose={() => setModal(null)}><form onSubmit={save}><div className="modal-content form-grid">{visibleFields.filter((item) => !(modal.mode === 'edit' && item.createOnly) && (!item.conditional || item.conditional(values))).map((item) => <FormField key={item.name} label={item.label} hint={item.hint} className={item.type === 'checkbox' ? 'field-full' : ''}><FieldInput field={item} values={values} setValues={setValues} options={options} /></FormField>)}</div><footer className="modal-footer"><Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button></footer></form></Modal>}
    {confirm && <ConfirmDialog title={`Delete ${singular}?`} message={`This change may not be reversible. Continue deleting “${confirm.name || confirm.code || confirm.username}”?`} confirmLabel="Delete record" onCancel={() => setConfirm(null)} onConfirm={() => remove(confirm)} />}
  </div>
}

function FieldInput({ field: item, values, setValues, options }) {
  const value = values[item.name] ?? ''
  const change = (next) => setValues({ ...values, [item.name]: next })
  if (item.type === 'checkbox') return <span className="checkbox-wrap"><input type="checkbox" checked={!!value} onChange={(event) => change(event.target.checked)} /> Yes</span>
  if (item.type === 'select') {
    const items = item.options || options[item.optionsKey] || []
    return <select required={item.required} value={value} onChange={(event) => change(event.target.value)}><option value="">Select {item.label.toLowerCase()}</option>{items.map((option) => <option key={option.id ?? option.value} value={option.id ?? option.value}>{option.label ?? option[item.optionLabel]}</option>)}</select>
  }
  return <input type={item.type || 'text'} required={item.required} min={item.min} max={item.max} step={item.step} minLength={item.minLength} maxLength={item.maxLength} value={value} onChange={(event) => change(item.type === 'checkbox' ? event.target.checked : event.target.value)} />
}
