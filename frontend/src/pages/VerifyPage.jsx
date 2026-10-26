import { useEffect, useState } from 'react'
import { BadgeCheck, CircleAlert, ReceiptText, ShieldCheck } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { dateTime, money } from '../utils/format'

export default function VerifyPage() {
  const { invoiceNo } = useParams()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState({ status: 'loading' })
  const hash = searchParams.get('h')

  useEffect(() => {
    let active = true
    if (!hash) {
      return () => {
        active = false
      }
    }
    api
      .get(`/public/verify/${encodeURIComponent(invoiceNo)}`, { params: { h: hash } })
      .then(({ data }) => {
        if (active) setState(data.data.valid ? { status: 'valid', invoice: data.data } : { status: 'invalid' })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [hash, invoiceNo])

  const status = hash ? state.status : 'invalid'
  const valid = status === 'valid'
  const invalid = status === 'invalid'
  return (
    <main className="verify-screen">
      <div className="verify-brand">
        <span>
          <ReceiptText size={20} />
        </span>{' '}
        ledgerline <small>BILLING SUITE</small>
      </div>
      <section className={`verify-card ${valid ? 'verify-valid' : invalid ? 'verify-invalid' : ''}`}>
        {valid ? <BadgeCheck size={36} /> : invalid ? <CircleAlert size={36} /> : <ShieldCheck size={36} />}
        <span className="eyebrow">INVOICE AUTHENTICITY CHECK</span>
        <h1>
          {valid
            ? 'Authentic invoice'
            : invalid
              ? 'Invalid or tampered invoice'
              : status === 'error'
                ? 'Verification unavailable'
                : 'Checking invoice…'}
        </h1>
        {valid && (
          <>
            <p className="verify-shop">{state.invoice.shopName}</p>
            <div className="verify-details">
              <span>Invoice</span>
              <strong>{state.invoice.invoiceNo}</strong>
              <span>Amount</span>
              <strong>{money(state.invoice.grandTotal)}</strong>
              <span>Issued</span>
              <strong>{dateTime(state.invoice.createdAt)}</strong>
            </div>
            <p className="verify-note">The invoice number, amount, and issue date match the store's signed record.</p>
          </>
        )}
        {invalid && (
          <p className="verify-note">
            The invoice signature could not be verified. Check the QR code or contact the store.
          </p>
        )}
        {status === 'error' && (
          <p className="verify-note">The verification service could not be reached. Please try again later.</p>
        )}
      </section>
      <p className="verify-footer">Secure invoice verification</p>
    </main>
  )
}
