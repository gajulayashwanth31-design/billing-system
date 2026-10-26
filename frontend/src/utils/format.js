export const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value || 0))

export const dateTime = (value) => value
  ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

export const dateOnly = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' })
  : '—'

export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

export const homeForRole = (role) => ({
  ADMIN: '/admin',
  CASHIER: '/pos',
  CUSTOMER: '/portal',
}[role] || '/login')
