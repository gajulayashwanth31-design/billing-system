import api from '../api/client'

export async function downloadInvoicePdf(id, invoiceNo) {
  const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
  const objectUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  const safeInvoiceNo = String(invoiceNo).replace(/[\\/:*?"<>|]/g, '_')
  link.href = objectUrl
  link.download = `${safeInvoiceNo}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
}
