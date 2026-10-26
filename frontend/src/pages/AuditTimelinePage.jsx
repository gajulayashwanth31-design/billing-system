import { useEffect, useState } from 'react'
import { GitCommitHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Card, PageHeader, Skeleton, StatusBadge } from '../components/UI'
import { dateTime } from '../utils/format'

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}

export default function AuditTimelinePage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api
      .get('/audit-log', { params: { limit: 100 } })
      .then(({ data }) => setRows(data.data))
      .catch((error) => toast.error(error.userMessage || 'Audit timeline could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="resource-page">
      <PageHeader
        title="Audit timeline"
        description="Follow important changes from their previous value to the new one."
        action={
          <span className="log-heading-icon">
            <GitCommitHorizontal size={17} /> Recent activity
          </span>
        }
      />
      {loading ? (
        <Skeleton rows={6} />
      ) : rows.length ? (
        <div className="audit-timeline">
          {rows.map((row) => (
            <article className="audit-timeline-entry" key={row.id}>
              <span className="audit-timeline-marker">
                <GitCommitHorizontal size={15} />
              </span>
              <Card className="audit-timeline-card">
                <div className="audit-timeline-heading">
                  <div>
                    <strong>{row.changedByName || (row.changedBy ? `User ${row.changedBy}` : 'System')}</strong>
                    <span>{dateTime(row.changedAt)}</span>
                  </div>
                  <StatusBadge status={row.action} />
                </div>
                <p>
                  <strong>{row.tableName}</strong> · record {row.recordId}
                </p>
                <div className="audit-timeline-values">
                  <div className="audit-value-before">
                    <span>BEFORE</span>
                    <pre>{formatValue(row.oldValue)}</pre>
                  </div>
                  <div className="audit-value-after">
                    <span>AFTER</span>
                    <pre>{formatValue(row.newValue)}</pre>
                  </div>
                </div>
              </Card>
            </article>
          ))}
        </div>
      ) : (
        <Card className="audit-timeline-empty">No audit events have been recorded yet.</Card>
      )}
    </div>
  )
}
