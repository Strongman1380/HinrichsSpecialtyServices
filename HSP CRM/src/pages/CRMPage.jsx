import { Link } from 'react-router-dom'
import { saveRecord, archiveRecord } from '../records'
import { useDialog } from '../components/Dialog'
import { useEffect, useState, useRef } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, onSnapshot, where, limit
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'
import { createPaymentRecord, archivePaymentRecord } from '../payment-service'
import NotConfigured from '../components/NotConfigured'
import {
  Users, Plus, Search, X, Phone, Mail, Building2,
  StickyNote, PhoneCall, MessageSquare, Calendar,
  Trash2, Edit2, ChevronRight, Loader2, Check, CircleDollarSign
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'all',      label: 'All',      color: '' },
  { value: 'lead',     label: 'Lead',     color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'client',   label: 'Client',   color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'prospect', label: 'Prospect', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'inactive', label: 'Inactive', color: 'bg-slate-100 text-slate-500 border-slate-200' },
]

const NOTE_TYPES = [
  { value: 'note',    label: 'Note',    icon: StickyNote },
  { value: 'call',    label: 'Call',    icon: PhoneCall },
  { value: 'email',   label: 'Email',   icon: MessageSquare },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
]

const PAYMENT_METHODS = [
  { value: 'venmo', label: 'Venmo' },
  { value: 'cash-app', label: 'Cash App' },
  { value: 'check', label: 'Check' },
  { value: 'wire', label: 'Wire transfer' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

function statusBadge(status) {
  const s = STATUSES.find(x => x.value === status)
  if (!s || !s.color) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${s.color}`}>
      {s.label}
    </span>
  )
}

// ─── Contact Form Modal ───────────────────────────────────────────────────────
function ContactModal({ contact, onClose, onSaved }) {
  useDialog(onClose)
  const [form, setForm] = useState({
    firstName: contact?.firstName || '',
    lastName:  contact?.lastName  || '',
    email:     contact?.email     || '',
    phone:     contact?.phone     || '',
    company:   contact?.company   || '',
    status:    contact?.status    || 'lead',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function save() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveRecord('contacts', { ...contact, ...form }, contact)
      onSaved()
      onClose()
    } catch (error) { setError(error.message || 'Failed to save. Please retry.') }
    finally { setSaving(false) }
  }

  const inputCls = 'input-dark w-full rounded-lg px-3 py-2 text-sm'

  return (
    <div role="dialog" aria-modal="true" aria-label="Contact editor" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
          <button aria-label="Close contact editor" onClick={onClose} className="min-h-11 min-w-11 text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact-firstName" className="block text-xs text-slate-500 mb-1">First Name *</label>
              <input id="contact-firstName" className={inputCls} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
            </div>
            <div>
              <label htmlFor="contact-lastName" className="block text-xs text-slate-500 mb-1">Last Name *</label>
              <input id="contact-lastName" className={inputCls} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="contact-email" className="block text-xs text-slate-500 mb-1">Email</label>
            <input type="email" id="contact-email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact-phone" className="block text-xs text-slate-500 mb-1">Phone</label>
              <input id="contact-phone" className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label htmlFor="contact-company" className="block text-xs text-slate-500 mb-1">Company</label>
              <input id="contact-company" className={inputCls} value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="contact-status" className="block text-xs text-slate-500 mb-1">Status</label>
            <select id="contact-status"
              className={`${inputCls} cursor-pointer`}
              value={form.status}
              onChange={e => set('status', e.target.value)}
            >
              {STATUSES.filter(s => s.value !== 'all').map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-green flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? 'Saving...' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Contact Detail Panel ─────────────────────────────────────────────────────
function ContactPanel({ contact, onClose, onEdit, onDelete }) {
  const [notes, setNotes]         = useState([])
  const [payments, setPayments]   = useState([])
  const [noteText, setNoteText]   = useState('')
  const [noteType, setNoteType]   = useState('note')
  const [addingNote, setAddingNote] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'venmo',
    reference: '',
    notes: '',
  })

  useEffect(() => {
    if (!contact?.id) return
    setLoadingNotes(true)
    const q = query(collection(db, 'contacts', contact.id, 'notes'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingNotes(false)
    }, () => { setLoadingNotes(false); setPaymentError("Notes could not load. Reopen the client to retry.") })
    return unsub
  }, [contact?.id])

  useEffect(() => {
    if (!contact?.id) return
    const q = query(collection(db, 'payments'), where('contactId', '==', contact.id))
    return onSnapshot(q, snap => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.paymentDate || '').localeCompare(String(a.paymentDate || ''))))
    }, () => setPaymentError('Payments could not load. Reopen the client to retry.'))
  }, [contact?.id])

  async function addNote() {
    if (!noteText.trim()) return
    setAddingNote(true)
    try { await saveRecord('notes', { contactId: contact.id, content: noteText.trim(), type: noteType }) } catch (error) { setPaymentError(error.message); setAddingNote(false); return }
    setNoteText('')
    setAddingNote(false)
  }

  async function deleteNote(noteId) {
    const note = notes.find(n => n.id === noteId)
    if (note) try { await archiveRecord('notes', note, contact.id) } catch (error) { setPaymentError(error.message) }
  }

  async function addPayment() {
    const amount = Number(paymentForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter a payment amount greater than $0.')
      return
    }
    if (!paymentForm.paymentDate) {
      setPaymentError('Choose the date the payment was received.')
      return
    }

    setAddingPayment(true)
    setPaymentError('')
    try {
      await createPaymentRecord({
        contactId: contact.id,
        contactName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.company || 'Client',
        invoiceId: '',
        amount: Math.round(amount * 100) / 100,
        paymentDate: paymentForm.paymentDate,
        method: paymentForm.method,
        reference: paymentForm.reference.trim(),
        notes: paymentForm.notes.trim(),
        status: 'received',
      })
      setPaymentForm({
        amount: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        method: 'venmo',
        reference: '',
        notes: '',
      })
      setShowPaymentForm(false)
    } catch (error) {
      setPaymentError(error.message || 'Failed to save the payment. Please retry.')
    } finally {
      setAddingPayment(false)
    }
  }

  async function deletePayment(paymentId) {
    const payment = payments.find(p => p.id === paymentId)
    if (!payment || !confirm('Archive this payment? Its financial effect will be preserved.')) return
    try { await archivePaymentRecord(payment) } catch (error) { setPaymentError(error.message) }
  }

  const totalPaid = payments.filter(payment => payment.status === 'received').reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const inputCls = 'input-dark w-full rounded-lg px-3 py-2 text-sm'

  const NoteIcon = ({ type }) => {
    const t = NOTE_TYPES.find(n => n.value === type)
    const Icon = t?.icon || StickyNote
    return <Icon size={14} />
  }

  const noteTypeColor = type => ({
    note:    'text-amber-500',
    call:    'text-blue-500',
    email:   'text-purple-500',
    meeting: 'text-emerald-500',
  }[type] || 'text-slate-400')

  return (
    <div className="flex flex-col h-full border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">
            {contact.firstName} {contact.lastName}
          </h3>
          {contact.company && <p className="text-sm text-slate-500 mt-0.5">{contact.company}</p>}
          <div className="mt-2">{statusBadge(contact.status)}</div>
          <Link className="inline-block py-3 font-semibold text-blue-700" to={`/clients/${contact.id}`}>Full client workspace →</Link>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="Edit contact" onClick={() => onEdit(contact)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors">
            <Edit2 size={16} />
          </button>
          <button aria-label={contact.archivedAt ? "Restore contact" : "Archive contact"} onClick={() => onDelete(contact)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Contact info */}
      <div className="px-5 py-3 border-b border-slate-200 space-y-2">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-500 transition-colors">
            <Mail size={14} className="shrink-0" />
            {contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-500 transition-colors">
            <Phone size={14} className="shrink-0" />
            {contact.phone}
          </a>
        )}
      </div>

      {/* Add note */}
      <div className="px-5 py-3 border-b border-slate-200">
        <div className="flex gap-2 mb-2">
          {NOTE_TYPES.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.value}
                onClick={() => setNoteType(t.value)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                  noteType === t.value
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={12} />
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <textarea
            className="input-dark flex-1 rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="Add a note, call log, or meeting summary..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote() }}
          />
          <button
            onClick={addNote}
            disabled={addingNote || !noteText.trim()}
            className="btn-green px-3 rounded-lg shrink-0 self-stretch"
          >
            {addingNote ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          </button>
        </div>
      </div>

      {/* Payments */}
      <div className="px-5 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CircleDollarSign size={16} className="text-emerald-500" />
            <h4 className="text-sm font-semibold text-slate-700">Payments</h4>
            <span className="text-sm font-semibold text-emerald-600">{totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
          </div>
          <button
            onClick={() => { setPaymentError(''); setShowPaymentForm(value => !value) }}
            className="text-xs btn-green px-2.5 py-1 rounded-lg flex items-center gap-1"
          >
            <Plus size={12} /> Log payment
          </button>
        </div>

        {showPaymentForm && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
            {paymentError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{paymentError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Amount *</label>
                <input type="number" min="0.01" step="0.01" className={inputCls} placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date received *</label>
                <input type="date" className={inputCls} value={paymentForm.paymentDate} onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Method *</label>
                <select className={`${inputCls} cursor-pointer`} value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Reference</label>
                <input className={inputCls} placeholder="Check # or confirmation" value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <input className={inputCls} placeholder="Notes (optional)" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowPaymentForm(false)} className="px-3 py-1.5 text-xs text-slate-500">Cancel</button>
              <button onClick={addPayment} disabled={addingPayment} className="btn-green px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                {addingPayment ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {addingPayment ? 'Saving...' : 'Save payment'}
              </button>
            </div>
          </div>
        )}

        {payments.length > 0 ? (
          <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
            {payments.map(payment => {
              const method = PAYMENT_METHODS.find(item => item.value === payment.method)?.label || payment.method || 'Other'
              return (
                <div key={payment.id} className="group flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700">{method} · {payment.paymentDate}</p>
                    {(payment.reference || payment.notes) && <p className="text-xs text-slate-400 truncate">{payment.reference || payment.notes}</p>}
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{Number(payment.amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                  <button onClick={() => deletePayment(payment.id)} className="min-h-11 min-w-11 text-slate-500 hover:text-red-600 shrink-0" aria-label="Archive payment">
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-2">No payments logged yet.</p>
        )}
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {loadingNotes ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-slate-300 text-center py-6">No activity yet</p>
        ) : (
          notes.filter(note => !note.archivedAt).map(note => (
            <div key={note.id} className="group flex gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all">
              <span className={`mt-0.5 shrink-0 ${noteTypeColor(note.type)}`}><NoteIcon type={note.type} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-600 leading-relaxed">{note.content}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {note.createdAt?.toDate?.()?.toLocaleString() ?? ''}
                </p>
              </div>
              <button
                aria-label="Archive note" onClick={() => deleteNote(note.id)}
                className="min-h-11 min-w-11 text-slate-500 hover:text-red-600 shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [recordLimit, setRecordLimit] = useState(100)
  const [loadError, setLoadError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [contacts, setContacts]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filter, setFilter]               = useState('all')
  const [selected, setSelected]           = useState(null)
  const [showModal, setShowModal]         = useState(false)
  const [editingContact, setEditingContact] = useState(null)

  function loadContacts() {
    setLoading(true)
    const q = query(collection(db, 'contacts'), limit(recordLimit))
    return onSnapshot(q, snap => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => { setLoadError('Clients could not load. Refresh to retry.'); setLoading(false) })
  }

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return }
    const unsub = loadContacts()
    return unsub
  }, [recordLimit])

  async function deleteContact(contact) {
    if (!confirm(`${contact.archivedAt ? 'Restore' : 'Archive'} ${contact.firstName} ${contact.lastName}? Linked records will be preserved.`)) return
    try { await archiveRecord('contacts', contact) } catch (error) { setLoadError(error.message); return }
    if (selected?.id === contact.id) setSelected(null)
  }

  function openEdit(contact) {
    setEditingContact(contact)
    setShowModal(true)
  }

  function handleModalClose() {
    setShowModal(false)
    setEditingContact(null)
  }

  function onSaved() {
    setEditingContact(null)
  }

  const filtered = contacts.filter(c => {
    const matchesFilter = filter === 'all' || c.status === filter
    const name = `${c.firstName} ${c.lastName} ${c.company || ''} ${c.email || ''}`.toLowerCase()
    const matchesSearch = name.includes(search.toLowerCase())
    return matchesFilter && matchesSearch && Boolean(c.archivedAt) === showArchived
  })

  if (!isFirebaseConfigured) return <NotConfigured feature="CRM" />

  return (
    <div className="flex h-full -m-4 md:-m-8 mt-0 md:mt-0" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Left pane */}
      <div className={`flex flex-col ${selected ? 'hidden md:flex md:w-1/2 lg:w-3/5' : 'flex-1'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">CRM</h1>
            <p className="text-slate-500 text-sm mt-0.5">{contacts.length} loaded contacts</p>
          </div>
          <button
            onClick={() => { setEditingContact(null); setShowModal(true) }}
            className="btn-green flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
          >
            <Plus size={16} />
            Add Contact
          </button>
        </div>

        <button className="py-3 text-blue-700" onClick={() => setRecordLimit(n => n + 100)}>Load more / retry clients</button>
        {loadError && <p role="alert">{loadError}</p>}
        <label className="px-4 py-2"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived clients</label>
        {selected && <Link className="px-4 py-3 font-bold text-blue-700" to={`/clients/${selected.id}`}>Open full client workspace →</Link>}
        {/* Search + filter */}
        <div className="px-4 md:px-8 py-3 border-b border-slate-200 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-dark w-full rounded-lg pl-9 pr-3 py-2 text-sm"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setFilter(s.value)}
                className={`text-xs px-3 py-1 rounded-lg border transition-all font-medium ${
                  filter === s.value
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Users size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                {contacts.length === 0 ? 'No contacts yet. Add your first one.' : 'No contacts match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${
                    selected?.id === c.id
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 font-semibold text-sm">
                    {c.firstName?.[0]}{c.lastName?.[0]}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 text-sm">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {c.company && <span>{c.company} · </span>}
                      {c.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(c.status)}
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      {selected && (
        <div className="flex-1 md:w-1/2 lg:w-2/5 flex flex-col overflow-hidden">
          <ContactPanel
            contact={contacts.find(c => c.id === selected.id) || selected}
            onClose={() => setSelected(null)}
            onEdit={openEdit}
            onDelete={deleteContact}
          />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ContactModal
          contact={editingContact}
          onClose={handleModalClose}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
