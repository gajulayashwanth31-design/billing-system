import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { money } from '../utils/format'

export function PageHeader({ title, description, action }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Card({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'mint' }) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon ${tone}`}>{Icon && <Icon size={19} />}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </Card>
  )
}

export function StatusBadge({ status }) {
  const value = String(status || 'UNKNOWN').toUpperCase()
  return <span className={`badge badge-${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span>
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'Try adjusting your filters or add a record.',
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark">—</span>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

export function Skeleton({ rows = 4 }) {
  return (
    <div className="skeleton-list" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index} />
      ))}
    </div>
  )
}

export function FormField({ label, error, hint, children, className = '' }) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

export function Modal({ title, children, onClose, size = 'normal' }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onCancel, onConfirm, busy = false }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="modal-content">
        <p>{message}</p>
      </div>
      <footer className="modal-footer">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </footer>
    </Modal>
  )
}

export function DataTable({ columns, rows, loading = false, emptyTitle, actions, rowKey = 'id' }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(null)
  const [page, setPage] = useState(1)
  const pageSize = 8
  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim()
    let result = rows.filter(
      (row) =>
        !needle ||
        columns.some((column) => {
          const value = column.value ? column.value(row) : row[column.key]
          return String(value ?? '')
            .toLowerCase()
            .includes(needle)
        }),
    )
    if (sort) {
      const column = columns.find((item) => item.key === sort.key)
      result = [...result].sort((a, b) => {
        const av = column?.value ? column.value(a) : a[sort.key]
        const bv = column?.value ? column.value(b) : b[sort.key]
        const comparison =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
        return sort.direction === 'asc' ? comparison : -comparison
      })
    }
    return result
  }, [rows, columns, search, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(key) {
    setPage(1)
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  function renderCell(column, row) {
    if (column.render) return column.render(row)
    if (column.value) return column.value(row)
    return row[column.key] ?? '—'
  }

  return (
    <div className="table-shell">
      <div className="table-toolbar">
        <div className="table-count">{filtered.length} records</div>
        <label className="table-search">
          <Search size={16} />
          <input
            aria-label="Search table"
            placeholder="Search this table…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </label>
      </div>
      {loading ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <EmptyState title={emptyTitle || 'No matching records'} />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>
                      <button className="sort-button" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <ChevronDown size={14} className={sort?.key === column.key ? 'sort-active' : ''} />
                      </button>
                    </th>
                  ))}
                  {actions && <th className="actions-col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => (
                  <tr key={row[rowKey] ?? index}>
                    {columns.map((column) => (
                      <td key={column.key}>{renderCell(column, row)}</td>
                    ))}
                    {actions && <td className="row-actions">{actions(row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>
              Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of{' '}
              {filtered.length}
            </span>
            <div>
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft size={17} />
              </button>
              <span>
                {page} / {pageCount}
              </span>
              <button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function LabeledValue({ label, value }) {
  return (
    <div className="labeled-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function Money({ value }) {
  return money(value)
}
