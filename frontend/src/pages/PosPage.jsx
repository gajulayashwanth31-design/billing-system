import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Barcode, Check, Minus, Plus, Search, ShoppingBag, Trash2, UserRoundPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Button, Card, FormField, Modal, PageHeader, Skeleton, StatusBadge } from '../components/UI'
import { dateTime, money, roundMoney } from '../utils/format'
import { downloadInvoicePdf } from '../utils/invoicePdf'

const today = new Date().toLocaleDateString('en-CA')
const registerDate = new Date()
const emptyCustomerForm = { name: '', phone: '', email: '', address: '', whatsappOptIn: true }

export default function PosPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState([])
  const [phone, setPhone] = useState('')
  const [customer, setCustomer] = useState(null)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [customerDialog, setCustomerDialog] = useState(false)
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm)
  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState(null)
  const [paymentType, setPaymentType] = useState('single')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [splitMethodA, setSplitMethodA] = useState('')
  const [splitMethodB, setSplitMethodB] = useState('')
  const [splitAmount, setSplitAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [completedInvoice, setCompletedInvoice] = useState(null)
  const [pendingCheckout, setPendingCheckout] = useState(null)
  const barcodeRef = useRef(null)
  const navigate = useNavigate()

  async function load() {
    try {
      const [productResponse, categoryResponse, methodResponse] = await Promise.all([
        api.get('/products', { params: { limit: 100, sort: 'name' } }),
        api.get('/categories', { params: { limit: 100 } }),
        api.get('/payment-methods'),
      ])
      setProducts(productResponse.data.data)
      setCategories(categoryResponse.data.data)
      setMethods(methodResponse.data.data)
      setPaymentMethod((current) => current || methodResponse.data.data[0]?.id || '')
      setSplitMethodA((current) => current || methodResponse.data.data[0]?.id || '')
      setSplitMethodB((current) => current || methodResponse.data.data[1]?.id || methodResponse.data.data[0]?.id || '')
    } catch (error) {
      toast.error(error.userMessage || 'Could not load the register.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = category === 'all' || Number(product.category_id) === Number(category)
        const term = search.trim().toLowerCase()
        return matchesCategory && (!term || `${product.name} ${product.sku}`.toLowerCase().includes(term))
      }),
    [products, category, search],
  )

  const totals = useMemo(() => {
    const subtotal = roundMoney(cart.reduce((sum, line) => sum + roundMoney(line.product.price * line.quantity), 0))
    const tax = roundMoney(
      cart.reduce(
        (sum, line) => sum + roundMoney((line.product.price * line.quantity * Number(line.product.tax_rate)) / 100),
        0,
      ),
    )
    const couponDiscountAmount = Number(discount?.discountAmount || 0)
    const tierDiscountPercent =
      customer?.tier === 'Platinum' ? 8 : customer?.tier === 'Gold' ? 5 : customer?.tier === 'Silver' ? 2 : 0
    const tierDiscountAmount = roundMoney(
      (Math.max(0, subtotal + tax - couponDiscountAmount) * tierDiscountPercent) / 100,
    )
    const discountAmount = roundMoney(couponDiscountAmount + tierDiscountAmount)
    return {
      subtotal,
      tax,
      couponDiscountAmount,
      tierDiscountPercent,
      tierDiscountAmount,
      discountAmount,
      grandTotal: roundMoney(Math.max(0, subtotal + tax - discountAmount)),
    }
  }, [cart, customer, discount])

  function addToCart(product) {
    if (pendingCheckout) return toast.error('Finish the payment for the pending invoice before changing this basket.')
    if (Number(product.stock_quantity) <= 0) return toast.error('This item is out of stock.')
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing && existing.quantity >= Number(product.stock_quantity)) {
        toast.error('You have reached the available stock for this item.')
        return current
      }
      return existing
        ? current.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...current, { product, quantity: 1 }]
    })
  }

  function setQuantity(id, amount) {
    if (pendingCheckout) return toast.error('Finish the payment for the pending invoice before changing this basket.')
    const line = cart.find((item) => item.product.id === id)
    if (line && amount > Number(line.product.stock_quantity)) {
      toast.error('Quantity cannot exceed available stock.')
      return
    }
    setCart((current) =>
      amount < 1
        ? current.filter((item) => item.product.id !== id)
        : current.map((item) => (item.product.id === id ? { ...item, quantity: amount } : item)),
    )
  }

  function addBySku(event) {
    event.preventDefault()
    const match = products.find((product) => product.sku.toLowerCase() === sku.trim().toLowerCase())
    if (!match) toast.error('No product found for that SKU.')
    else addToCart(match)
    setSku('')
    barcodeRef.current?.focus()
  }

  async function findCustomer(event) {
    event.preventDefault()
    if (pendingCheckout) return toast.error('Finish the payment for the pending invoice first.')
    if (!/^\+91[6-9]\d{9}$/.test(phone)) return toast.error('Enter a valid Indian mobile number, including +91.')
    setLookupBusy(true)
    try {
      const { data } = await api.get(`/customers/by-phone/${encodeURIComponent(phone)}`)
      setCustomer(data.data)
      toast.success(`${data.data.name} selected`)
    } catch (error) {
      if (error.response?.status === 404) {
        setCustomer(null)
        setCustomerForm({ ...emptyCustomerForm, phone })
        setCustomerDialog(true)
      } else toast.error(error.userMessage || 'Customer lookup failed.')
    } finally {
      setLookupBusy(false)
    }
  }

  async function createCustomer(event) {
    event.preventDefault()
    try {
      const { data } = await api.post('/customers', customerForm)
      setCustomer(data.data)
      setPhone(data.data.phone)
      setCustomerDialog(false)
      toast.success('Customer added to the register.')
    } catch (error) {
      toast.error(error.userMessage || 'Could not add customer.')
    }
  }

  async function applyDiscount() {
    if (pendingCheckout) return toast.error('Finish the payment for the pending invoice first.')
    const code = discountInput.trim().toUpperCase()
    if (!code) return toast.error('Enter a discount code first.')
    try {
      const { data } = await api.post('/discounts/validate', {
        code,
        billAmount: roundMoney(totals.subtotal + totals.tax),
      })
      setDiscount(data.data)
      setDiscountInput(data.data.code)
      toast.success('Discount applied.')
    } catch (error) {
      setDiscount(null)
      toast.error(error.userMessage || 'That discount could not be applied.')
    }
  }

  function clearDiscount() {
    setDiscount(null)
    setDiscountInput('')
  }

  async function generateBill() {
    if (!pendingCheckout && (!customer || !cart.length || totals.grandTotal <= 0)) return
    const selectedPayments =
      pendingCheckout?.payments ||
      (paymentType === 'single'
        ? [{ methodId: Number(paymentMethod), amount: totals.grandTotal }]
        : [
            { methodId: Number(splitMethodA), amount: roundMoney(Number(splitAmount)) },
            { methodId: Number(splitMethodB), amount: roundMoney(totals.grandTotal - Number(splitAmount)) },
          ])
    if (
      !pendingCheckout &&
      (selectedPayments.some((payment) => !payment.methodId || payment.amount <= 0) ||
        roundMoney(selectedPayments.reduce((sum, payment) => sum + payment.amount, 0)) !== totals.grandTotal)
    ) {
      toast.error('Enter two positive split amounts that add up to the bill total.')
      return
    }
    setBusy(true)
    let checkout = pendingCheckout
    try {
      if (!checkout) {
        const created = await api.post('/invoices', {
          customerId: customer.id,
          ...(discount ? { discountCode: discount.code } : {}),
          items: cart.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
        })
        checkout = { invoice: created.data.data, payments: selectedPayments, nextPayment: 0 }
        setPendingCheckout(checkout)
      }
      for (let index = checkout.nextPayment; index < checkout.payments.length; index += 1) {
        const response = await api.post(`/invoices/${checkout.invoice.id}/payments`, checkout.payments[index])
        checkout = { ...checkout, invoice: response.data.data, nextPayment: index + 1 }
        setPendingCheckout(checkout)
      }
      setCompletedInvoice(checkout.invoice)
      setPendingCheckout(null)
      setCart([])
      clearDiscount()
      toast.success('Invoice paid successfully.')
    } catch (error) {
      if (checkout) setPendingCheckout(checkout)
      toast.error(
        checkout
          ? `${error.userMessage || 'Payment could not be recorded.'} Invoice ${checkout.invoice.invoiceNo} is saved; retry payment to finish.`
          : error.userMessage || 'Could not create the invoice.',
      )
    } finally {
      setBusy(false)
    }
  }

  const [todayInvoices, setTodayInvoices] = useState([])
  useEffect(() => {
    api
      .get('/invoices', { params: { from: today, to: today, limit: 20 } })
      .then(({ data }) => setTodayInvoices(data.data))
      .catch((error) => toast.error(error.userMessage || "Today's invoices could not be loaded."))
  }, [completedInvoice?.id])

  const completedInvoiceId = completedInvoice?.id
  const completedWhatsappStatus = completedInvoice?.whatsapp?.status
  useEffect(() => {
    if (!completedInvoiceId || completedWhatsappStatus !== 'QUEUED') return undefined
    const timer = window.setInterval(() => {
      api
        .get(`/invoices/${completedInvoiceId}`)
        .then(({ data }) => setCompletedInvoice(data.data))
        .catch((error) => toast.error(error.userMessage || 'WhatsApp delivery status could not be refreshed.'))
    }, 1500)
    return () => window.clearInterval(timer)
  }, [completedInvoiceId, completedWhatsappStatus])

  async function resendInvoiceOnWhatsApp() {
    setResendBusy(true)
    try {
      await api.post(`/invoices/${completedInvoice.id}/resend-whatsapp`)
      const { data } = await api.get(`/invoices/${completedInvoice.id}`)
      setCompletedInvoice(data.data)
      if (data.data.whatsapp?.status === 'FAILED') toast.error(data.data.whatsapp.error || 'WhatsApp delivery failed.')
      else toast.success('Invoice notification queued.')
    } catch (error) {
      toast.error(error.userMessage || 'Invoice could not be queued for WhatsApp.')
    } finally {
      setResendBusy(false)
    }
  }

  if (completedInvoice)
    return (
      <div className="success-wrap">
        <Card className="success-card">
          <div className="success-icon">
            <Check size={32} />
          </div>
          <span className="eyebrow">PAYMENT COMPLETE</span>
          <h1>Bill generated.</h1>
          <p className="success-subtitle">
            Invoice <strong>{completedInvoice.invoiceNo}</strong> for {customer?.name} has been paid.
          </p>
          <div className="success-total">{money(completedInvoice.grandTotal)}</div>
          <div className="invoice-mini-summary">
            <div>
              <span>Subtotal</span>
              <strong>{money(completedInvoice.subtotal)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{money(completedInvoice.tax)}</strong>
            </div>
            {Number(completedInvoice.couponDiscountAmount) > 0 && (
              <div>
                <span>Coupon discount</span>
                <strong>− {money(completedInvoice.couponDiscountAmount)}</strong>
              </div>
            )}
            {Number(completedInvoice.tierDiscountAmount) > 0 && (
              <div>
                <span>{completedInvoice.tierDiscountPercent}% loyalty discount</span>
                <strong>− {money(completedInvoice.tierDiscountAmount)}</strong>
              </div>
            )}
            <div className="mini-grand">
              <span>Amount paid</span>
              <strong>{money(completedInvoice.paidAmount)}</strong>
            </div>
          </div>
          <div className="success-meta">
            <StatusBadge status={completedInvoice.status} />
            <span>
              WhatsApp <StatusBadge status={completedInvoice.whatsapp?.status || 'QUEUED'} />
            </span>
          </div>
          <div className="success-actions">
            <Button
              variant="secondary"
              onClick={() =>
                downloadInvoicePdf(completedInvoice.id, completedInvoice.invoiceNo).catch((error) =>
                  toast.error(error.userMessage || 'PDF could not be downloaded.'),
                )
              }
            >
              Download PDF
            </Button>
            <Button variant="secondary" disabled={resendBusy} onClick={resendInvoiceOnWhatsApp}>
              {resendBusy ? 'Sending…' : 'Resend on WhatsApp'}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print receipt
            </Button>
            <Button
              onClick={() => {
                setCompletedInvoice(null)
                setCustomer(null)
                setPhone('')
              }}
            >
              New bill
            </Button>
          </div>
        </Card>
      </div>
    )

  return (
    <div className="pos-page">
      <PageHeader
        title="Point of sale"
        description={`Good business starts here · ${registerDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        action={
          <div className="register-status">
            <span /> Register open
          </div>
        }
      />
      <div className="pos-layout">
        <div className="catalog-panel">
          <Card className="catalog-card">
            <div className="catalog-heading">
              <div>
                <span className="eyebrow">THE CATALOG</span>
                <h2>Find something good.</h2>
              </div>
              <span className="item-count">{products.length} items</span>
            </div>
            <div className="catalog-tools">
              <label className="catalog-search">
                <Search size={17} />
                <input
                  aria-label="Search products"
                  placeholder="Search by name or SKU…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <form className="barcode-search" onSubmit={addBySku}>
                <Barcode size={17} />
                <input
                  ref={barcodeRef}
                  aria-label="Scan product SKU"
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="Scan SKU"
                />
              </form>
            </div>
            <div className="category-chips">
              <button className={category === 'all' ? 'chip chip-active' : 'chip'} onClick={() => setCategory('all')}>
                Everything
              </button>
              {categories.map((item) => (
                <button
                  key={item.id}
                  className={Number(category) === item.id ? 'chip chip-active' : 'chip'}
                  onClick={() => setCategory(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            {loading ? (
              <Skeleton rows={5} />
            ) : (
              <div className="product-grid">
                {filteredProducts.map((product, index) => (
                  <button
                    key={product.id}
                    className={`product-tile ${Number(product.stock_quantity) < 1 ? 'product-disabled' : ''}`}
                    disabled={Number(product.stock_quantity) < 1}
                    onClick={() => addToCart(product)}
                  >
                    <span className={`product-illustration illustration-${index % 5}`}>
                      <ShoppingBag size={21} />
                    </span>
                    <span className="product-name">{product.name}</span>
                    <span className="product-sku">{product.sku}</span>
                    <span className="product-price">{money(product.price)}</span>
                    <span className={`stock-label ${Number(product.stock_quantity) <= 5 ? 'stock-low' : ''}`}>
                      {Number(product.stock_quantity) < 1 ? 'Out of stock' : `${product.stock_quantity} in stock`}
                    </span>
                    <span className="tile-add">
                      <Plus size={15} />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!loading && !filteredProducts.length && <div className="no-products">No products match this search.</div>}
          </Card>
        </div>
        <aside className="checkout-column">
          <Card className="checkout-card">
            <div className="checkout-heading">
              <div>
                <span className="eyebrow">CURRENT ORDER</span>
                <h2>Your basket</h2>
              </div>
              <span className="cart-count">{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span>
            </div>
            <div className="customer-box">
              <div className="section-label">CUSTOMER</div>
              {customer ? (
                <div className="selected-customer">
                  <div className="customer-avatar">{customer.name.slice(0, 1).toUpperCase()}</div>
                  <div className="customer-summary">
                    <strong>{customer.name}</strong>
                    <span>{customer.phone}</span>
                  </div>
                  {customer.tier && (
                    <span className={`tier-badge tier-${customer.tier.toLowerCase()}`}>{customer.tier}</span>
                  )}
                  <button
                    className="icon-button"
                    aria-label="Remove selected customer"
                    onClick={() => setCustomer(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
              ) : (
                <form className="customer-lookup" onSubmit={findCustomer}>
                  <input
                    aria-label="Customer phone number"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+91 mobile number"
                  />
                  <Button type="submit" variant="secondary" disabled={lookupBusy}>
                    {lookupBusy ? '…' : 'Find'}
                  </Button>
                  <button
                    type="button"
                    className="add-customer"
                    title="Add a customer"
                    onClick={() => {
                      setCustomerForm({ ...emptyCustomerForm, phone })
                      setCustomerDialog(true)
                    }}
                  >
                    <UserRoundPlus size={17} />
                  </button>
                </form>
              )}
            </div>
            <div className="cart-lines">
              {cart.length ? (
                cart.map(({ product, quantity }) => (
                  <div className="cart-line" key={product.id}>
                    <div className={`cart-thumb illustration-${product.id % 5}`}>
                      <ShoppingBag size={16} />
                    </div>
                    <div className="cart-line-info">
                      <strong>{product.name}</strong>
                      <span>
                        {money(product.price)} · {product.tax_rate}% tax
                      </span>
                    </div>
                    <div className="quantity-control">
                      <button
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        aria-label={`Decrease ${product.name}`}
                      >
                        <Minus size={13} />
                      </button>
                      <span>{quantity}</span>
                      <button
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        aria-label={`Increase ${product.name}`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <strong className="line-total">{money(roundMoney(product.price * quantity))}</strong>
                    <button
                      className="remove-line"
                      onClick={() => setQuantity(product.id, 0)}
                      aria-label={`Remove ${product.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="cart-empty">
                  <span className="cart-empty-icon">
                    <ShoppingBag size={23} />
                  </span>
                  <strong>Your basket is waiting</strong>
                  <span>Add an item from the catalog to get started.</span>
                </div>
              )}
            </div>
            <div className="discount-box">
              <div className="section-label">DISCOUNT CODE</div>
              <div className="discount-input">
                <input
                  aria-label="Discount code"
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value.toUpperCase())}
                  placeholder="Enter a coupon"
                  disabled={!!discount}
                />
                <Button variant={discount ? 'ghost' : 'secondary'} onClick={discount ? clearDiscount : applyDiscount}>
                  {discount ? 'Remove' : 'Apply'}
                </Button>
              </div>
              {discount && (
                <div className="discount-applied">
                  <Check size={14} /> {discount.code} · {money(discount.discountAmount)} off
                </div>
              )}
            </div>
            <div className="total-breakdown">
              <div>
                <span>Subtotal</span>
                <strong>{money(totals.subtotal)}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{money(totals.tax)}</strong>
              </div>
              {totals.couponDiscountAmount > 0 && (
                <div className="discount-row">
                  <span>Coupon discount</span>
                  <strong>− {money(totals.couponDiscountAmount)}</strong>
                </div>
              )}
              {totals.tierDiscountAmount > 0 && (
                <div className="discount-row">
                  <span>
                    {customer?.tier} loyalty discount ({totals.tierDiscountPercent}%)
                  </span>
                  <strong>− {money(totals.tierDiscountAmount)}</strong>
                </div>
              )}
              <div className="grand-total">
                <span>Total due</span>
                <strong>{money(totals.grandTotal)}</strong>
              </div>
            </div>
            <div className="payment-box">
              <div className="section-label">PAYMENT METHOD</div>
              <div className="payment-toggle">
                <button
                  className={paymentType === 'single' ? 'payment-active' : ''}
                  onClick={() => setPaymentType('single')}
                >
                  One method
                </button>
                <button
                  className={paymentType === 'split' ? 'payment-active' : ''}
                  onClick={() => setPaymentType('split')}
                >
                  Split payment
                </button>
              </div>
              {paymentType === 'single' ? (
                <select
                  aria-label="Payment method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="split-fields">
                  <div>
                    <select
                      aria-label="First payment method"
                      value={splitMethodA}
                      onChange={(event) => setSplitMethodA(event.target.value)}
                    >
                      {methods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="First split amount"
                      type="number"
                      min="0.01"
                      max={totals.grandTotal}
                      step="0.01"
                      placeholder="First amount"
                      value={splitAmount}
                      onChange={(event) => setSplitAmount(event.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      aria-label="Second payment method"
                      value={splitMethodB}
                      onChange={(event) => setSplitMethodB(event.target.value)}
                    >
                      {methods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Second split amount"
                      readOnly
                      value={splitAmount ? money(Math.max(0, totals.grandTotal - Number(splitAmount))) : ''}
                      placeholder="Remaining balance"
                    />
                  </div>
                </div>
              )}
            </div>
            {pendingCheckout && (
              <div className="pending-payment-warning">
                Invoice {pendingCheckout.invoice.invoiceNo} is saved. Complete its payment before starting another bill.
              </div>
            )}
            <Button
              className="generate-button"
              disabled={(!pendingCheckout && (!cart.length || !customer)) || !methods.length || busy}
              onClick={generateBill}
            >
              {busy ? 'Processing payment…' : pendingCheckout ? 'Retry payment' : 'Generate bill'}
              <span>{money(pendingCheckout?.invoice.grandTotal ?? totals.grandTotal)}</span>
            </Button>
            <p className="secure-note">
              <span /> Stock and invoice totals are verified at checkout
            </p>
          </Card>
        </aside>
      </div>
      <Card className="today-card">
        <div className="today-heading">
          <div>
            <span className="eyebrow">A QUICK LOOK BACK</span>
            <h2>Today's invoices</h2>
          </div>
          <Button variant="ghost" onClick={() => navigate('/pos/invoices')}>
            View all <span>→</span>
          </Button>
        </div>
        {!todayInvoices.length ? (
          <p className="today-empty">Invoices completed today will appear here.</p>
        ) : (
          <div className="today-list">
            {todayInvoices.slice(0, 5).map((invoice) => (
              <button key={invoice.id} className="today-row" onClick={() => navigate(`/pos/invoices/${invoice.id}`)}>
                <span className="invoice-dot">
                  <ShoppingBag size={15} />
                </span>
                <span className="today-invoice-copy">
                  <strong>{invoice.invoiceNo}</strong>
                  <span>
                    {invoice.customerName} · {dateTime(invoice.createdAt)}
                  </span>
                </span>
                <StatusBadge status={invoice.status} />
                <strong>{money(invoice.grandTotal)}</strong>
              </button>
            ))}
          </div>
        )}
      </Card>
      {customerDialog && (
        <Modal title="Add customer" onClose={() => setCustomerDialog(false)}>
          <form onSubmit={createCustomer}>
            <div className="modal-content form-grid">
              <FormField label="Full name">
                <input
                  required
                  maxLength="150"
                  value={customerForm.name}
                  onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })}
                />
              </FormField>
              <FormField label="Mobile number">
                <input
                  required
                  pattern="\\+91[6-9][0-9]{9}"
                  placeholder="+919876543210"
                  value={customerForm.phone}
                  onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })}
                />
              </FormField>
              <FormField label="Email (optional)">
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })}
                />
              </FormField>
              <FormField label="Address (optional)" className="field-full">
                <textarea
                  rows="2"
                  value={customerForm.address}
                  onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })}
                />
              </FormField>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={customerForm.whatsappOptIn}
                  onChange={(event) => setCustomerForm({ ...customerForm, whatsappOptIn: event.target.checked })}
                />{' '}
                Customer agrees to receive WhatsApp updates
              </label>
            </div>
            <footer className="modal-footer">
              <Button type="button" variant="ghost" onClick={() => setCustomerDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save customer</Button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  )
}
