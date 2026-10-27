import { useEffect, useState } from 'react'
import { ArrowRight, Award, Download, MapPin, Pencil, Phone, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Button, Card, DataTable, FormField, Modal, PageHeader, Skeleton, StatusBadge } from '../components/UI'
import { dateOnly, money } from '../utils/format'
import { downloadInvoicePdf } from '../utils/invoicePdf'

export default function PortalPage() {
  const [profile, setProfile] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    Promise.all([api.get('/me/profile'), api.get('/me/loyalty'), api.get('/me/invoices', { params: { limit: 100 } })])
      .then(([profileResponse, loyaltyResponse, invoiceResponse]) => {
        setProfile(profileResponse.data.data)
        setPhone(profileResponse.data.data.phone)
        setAddress(profileResponse.data.data.address || '')
        setLoyalty(loyaltyResponse.data.data)
        setInvoices(invoiceResponse.data.data)
      })
      .catch((error) => toast.error(error.userMessage || 'Your account information could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.put('/me/profile', { phone, address: address || null })
      setProfile((current) => ({ ...current, ...data.data }))
      setEditing(false)
      toast.success('Your profile was updated.')
    } catch (error) {
      toast.error(error.userMessage || 'Profile could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  const nextThreshold = loyalty?.tier === 'Silver' ? 10000 : loyalty?.tier === 'Gold' ? 50000 : null
  const progress = nextThreshold ? Math.min(100, (Number(loyalty?.lifetimeSpend || 0) / nextThreshold) * 100) : 100
  const tierMessage =
    loyalty?.tier === 'Platinum'
      ? 'You have reached our highest loyalty tier.'
      : `${money(Math.max(0, nextThreshold - Number(loyalty?.lifetimeSpend || 0)))} until ${loyalty?.tier === 'Silver' ? 'Gold' : 'Platinum'}`
  const columns = [
    {
      key: 'invoiceNo',
      label: 'Invoice',
      render: (row) => <strong className="invoice-number">{row.invoiceNo}</strong>,
    },
    { key: 'createdAt', label: 'Date', value: (row) => dateOnly(row.createdAt) },
    { key: 'grandTotal', label: 'Total', render: (row) => money(row.grandTotal) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]
  if (loading)
    return (
      <div className="portal-page">
        <PageHeader title="Your account" description="Your billing history, all in one place." />
        <Skeleton rows={6} />
      </div>
    )
  return (
    <div className="portal-page">
      <PageHeader
        title={`Hello, ${profile?.name?.split(' ')[0] || 'there'}.`}
        description="Your purchases and rewards, all in one place."
        action={
          <span className="customer-welcome-mark">
            <Sparkles size={15} /> YOUR CUSTOMER SPACE
          </span>
        }
      />
      <div className="portal-hero-grid">
        <Card className="loyalty-card">
          <div className="loyalty-top">
            <span className="eyebrow">YOUR LOYALTY</span>
            <span className={`tier-badge tier-${loyalty?.tier?.toLowerCase()}`}>
              <Award size={14} /> {loyalty?.tier || 'Silver'} member
            </span>
          </div>
          <div className="loyalty-points">
            {Number(loyalty?.points || 0).toLocaleString('en-IN')}
            <span> points</span>
          </div>
          <p>Thanks for choosing us. Every purchase brings you closer to your next reward.</p>
          <div className="loyalty-progress-label">
            <span>
              {loyalty?.tier || 'Silver'} <Star size={13} />
            </span>
            {nextThreshold && (
              <span>
                {loyalty?.tier === 'Silver' ? 'Gold' : 'Platinum'} <Star size={13} />
              </span>
            )}
          </div>
          <div className="loyalty-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="loyalty-next">{tierMessage}</div>
        </Card>
        <Card className="profile-card">
          <div className="profile-card-heading">
            <div>
              <span className="eyebrow">YOUR PROFILE</span>
              <h2>A little about you.</h2>
            </div>
            <button className="small-icon-button" aria-label="Edit profile" onClick={() => setEditing(true)}>
              <Pencil size={15} />
            </button>
          </div>
          <div className="portal-profile-name">
            <span className="portal-avatar">{profile?.name?.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{profile?.name}</strong>
              <span>Member since {dateOnly(profile?.createdAt)}</span>
            </div>
            <ShieldCheck size={17} />
          </div>
          <div className="profile-detail-row">
            <Phone size={15} />
            <span>{profile?.phone}</span>
          </div>
          <div className="profile-detail-row">
            <MapPin size={15} />
            <span>{profile?.address || 'Add a delivery address'}</span>
          </div>
        </Card>
      </div>
      <div className="portal-invoices">
        <div className="portal-section-heading">
          <div>
            <span className="eyebrow">YOUR PURCHASES</span>
            <h2>Invoice history</h2>
          </div>
          <span className="invoice-total">{invoices.length} invoices</span>
        </div>
        <Card className="data-card">
          <DataTable
            columns={columns}
            rows={invoices}
            emptyTitle="No invoices yet"
            actions={(row) => (
              <div className="portal-actions">
                <Link className="text-link" to={`/portal/invoices/${row.id}`}>
                  Details <ArrowRight size={14} />
                </Link>
                <button
                  className="pdf-download"
                  onClick={() =>
                    downloadInvoicePdf(row.id, row.invoiceNo).catch((error) =>
                      toast.error(error.userMessage || 'PDF could not be downloaded.'),
                    )
                  }
                >
                  <Download size={14} /> PDF
                </button>
              </div>
            )}
          />
        </Card>
      </div>
      {editing && (
        <Modal title="Edit your profile" onClose={() => setEditing(false)}>
          <form onSubmit={saveProfile}>
            <div className="modal-content form-grid">
              <FormField label="Name" hint="Your name can only be changed by an administrator.">
                <input value={profile?.name || ''} disabled />
              </FormField>
              <FormField label="Phone number">
                <input
                  type="tel"
                  inputMode="tel"
                  required
                  maxLength={13}
                  pattern="\+91[6-9][0-9]{9}"
                  title="Enter +91 followed by a 10-digit Indian mobile number."
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </FormField>
              <FormField label="Address" className="field-full">
                <textarea
                  rows="3"
                  maxLength="500"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Add your delivery address"
                />
              </FormField>
            </div>
            <footer className="modal-footer">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save profile'}
              </Button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  )
}
