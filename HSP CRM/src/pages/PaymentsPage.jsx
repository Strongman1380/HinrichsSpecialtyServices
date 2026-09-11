import { useDialog } from "../components/Dialog";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  limit,
  getDocs,
  onSnapshot,
  query,
} from "firebase/firestore";
import { CalendarDays, Check, CircleDollarSign, Edit2, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { db, isFirebaseConfigured } from "../firebase";
import NotConfigured from "../components/NotConfigured";
import { filterPayments, money, PAYMENT_METHODS, PAYMENT_STATUSES, paymentMethodLabel, paymentStatusLabel } from "../payment-utils";
import { createPaymentRecord, archivePaymentRecord, updatePaymentRecord } from "../payment-service";
import { financialClientId, financialClientOptions, financialRecord, paymentInvoiceOptions } from "../finance-options";
import { adminRequest } from "../api";
import { localDate, useChicagoDate } from "../records";

const emptyForm = () => ({
  contactId: "",
  invoiceId: "",
  amount: "",
  paymentDate: localDate(),
  method: "venmo",
  status: "received",
  reference: "",
  notes: "",
});

function PaymentForm({ payment, contacts, invoices, onClose }) {
  useDialog(onClose);
  const [form, setForm] = useState(payment ? { ...emptyForm(), ...payment, contactId: financialClientId(payment), amount: String(payment.amount || "") } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retainedContact, setRetainedContact] = useState(null);
  const [retainedInvoice, setRetainedInvoice] = useState(null);
  const [loadingLinks, setLoadingLinks] = useState(Boolean(payment));
  const [reconciliations, setReconciliations] = useState({});
  const inputClass = "input-dark w-full rounded-lg px-3 py-2.5 text-sm";
  const knownContacts = retainedContact && !contacts.some(contact => contact.id === retainedContact.id) ? [...contacts, retainedContact] : contacts;
  const knownInvoices = retainedInvoice && !invoices.some(invoice => invoice.id === retainedInvoice.id) ? [...invoices, retainedInvoice] : invoices;
  const availableContacts = financialClientOptions(knownContacts, payment);
  const availableInvoices = paymentInvoiceOptions(knownInvoices, form.contactId, payment, knownContacts);
  const affectedInvoices = payment ? [...new Set([payment.invoiceId, form.invoiceId].filter(Boolean))].map(id => knownInvoices.find(invoice => invoice.id === id)).filter(Boolean) : [];

  useEffect(() => {
    if (!payment) return;
    let active = true;
    const load = async (collectionName, id) => {
      if (!id) return null;
      const snapshot = await getDoc(doc(db, collectionName, id));
      return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
    };
    Promise.all([load("contacts", financialClientId(payment)), load("invoices", payment.invoiceId)]).then(([contact, invoice]) => {
      if (active) { setRetainedContact(contact); setRetainedInvoice(invoice); }
    }).catch(() => { if (active) setError("Existing links could not load. Close and reopen before reconciling an invoice."); })
      .finally(() => { if (active) setLoadingLinks(false); });
    return () => { active = false; };
  }, [payment]);

  function set(name, value) {
    setForm((current) => ({ ...current, [name]: value, ...(name === "contactId" ? { invoiceId: "" } : {}) }));
    if (["contactId", "invoiceId", "amount", "status"].includes(name)) setReconciliations({});
  }

  async function save(event) {
    event.preventDefault();
    const amount = Math.round(Number(form.amount) * 100) / 100;
    if (!form.contactId) return setError("Choose a client.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter an amount greater than $0.");
    if (!form.paymentDate) return setError("Choose the payment date.");
    const invoiceReconciliations = Object.entries(reconciliations).map(([invoiceId, correction]) => ({ invoiceId, ...correction }));
    if (invoiceReconciliations.some(correction => correction.correctedAmountPaid === "" || !Number.isFinite(Number(correction.correctedAmountPaid)) || Number(correction.correctedAmountPaid) < 0 || !correction.reason.trim())) return setError("Each reconciliation needs the verified paid amount after this change and a reason.");

    setSaving(true);
    setError("");
    try {
      const contact = contacts.find((entry) => entry.id === form.contactId);
      const data = {
        contactId: form.contactId,
        contactName: [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || contact?.company || "Client",
        invoiceId: form.invoiceId || "",
        amount,
        paymentDate: form.paymentDate,
        method: form.method,
        reference: form.reference.trim().slice(0, 200),
        notes: form.notes.trim().slice(0, 2000),
        status: form.status,
        correctionReason: form.correctionReason || "",
        ...(invoiceReconciliations.length ? { invoiceReconciliations } : {}),
      };
      if (payment?.id) {
        await updatePaymentRecord(payment.id, data, payment.version || 0);
      } else {
        await createPaymentRecord(data);
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message || "The payment could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-form-title">
      <form onSubmit={save} className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="payment-form-title" className="text-lg font-bold text-slate-800">{payment ? "Edit payment" : "Log payment"}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Client <span className="sr-only">required</span>
            <select className={inputClass} value={form.contactId} onChange={(event) => set("contactId", event.target.value)} required>
              <option value="">Choose a client</option>
              {availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company}{contact.archivedAt ? " (archived — existing client)" : contact.retainedOnly ? " (existing client — not loaded)" : ""}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Invoice (optional)
            <select className={inputClass} value={form.invoiceId} onChange={(event) => set("invoiceId", event.target.value)}>
              <option value="">Not linked to an invoice</option>
              {availableInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber}{invoice.retainedOnly ? " (existing link — not loaded)" : ` - ${money(invoice.balanceDue ?? invoice.total)}`}{invoice.archivedAt ? " (archived — existing link)" : ""}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Amount
            <input className={inputClass} type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => set("amount", event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Date received
            <input className={inputClass} type="date" value={form.paymentDate} onChange={(event) => set("paymentDate", event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Payment method
            <select className={inputClass} value={form.method} onChange={(event) => set("method", event.target.value)}>
              {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </label>
          <div className="grid gap-1.5 text-sm font-medium text-slate-700">
            <label htmlFor="payment-status">Status</label>
            <select id="payment-status" className={inputClass} value={form.status} onChange={(event) => set("status", event.target.value)}>
              {PAYMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Reference or confirmation
            <input className={inputClass} value={form.reference} onChange={(event) => set("reference", event.target.value)} maxLength={200} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
            Notes
            <textarea className={inputClass} rows="3" value={form.notes} onChange={(event) => set("notes", event.target.value)} maxLength={2000} />
          </label>
          {payment && <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Correction reason (optional)<input className={inputClass} value={form.correctionReason || ""} onChange={event => set("correctionReason", event.target.value)} maxLength={1000} /></label>}
          {affectedInvoices.map(invoice => {
            const correction = reconciliations[invoice.id];
            return <fieldset key={invoice.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-semibold">Invoice {invoice.invoiceNumber || invoice.id}</legend>
              {(Number(invoice.adjustmentCents) < 0 || invoice.reconciliationRequired || invoice.accountingVersion !== 2) && <p className="text-sm text-amber-800">This invoice has a balance adjustment or needs reconciliation. A reversal, reduction, or unlink may require a verified paid total.</p>}
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(correction)} onChange={event => setReconciliations(current => {
                const next = { ...current };
                if (event.target.checked) next[invoice.id] = { expectedVersion: invoice.version || 0, correctedAmountPaid: "", reason: "" };
                else delete next[invoice.id];
                return next;
              })} />Reconcile this invoice with the payment correction</label>
              {correction && <>
                <p className="text-xs text-slate-500">Enter the verified total paid after this payment change. The balance adjustment and payment will be saved together. Changing the payment amount, status, or links clears this review.</p>
                <label className="grid gap-1 text-sm">Verified amount paid after this change<input className={inputClass} type="number" min="0" step="0.01" required value={correction.correctedAmountPaid} onChange={event => setReconciliations(current => ({ ...current, [invoice.id]: { ...current[invoice.id], correctedAmountPaid: event.target.value } }))} /></label>
                <label className="grid gap-1 text-sm">Reconciliation reason<input className={inputClass} required maxLength={1000} value={correction.reason} onChange={event => setReconciliations(current => ({ ...current, [invoice.id]: { ...current[invoice.id], reason: event.target.value } }))} /></label>
              </>}
            </fieldset>;
          })}
          {error && <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button disabled={saving || loadingLinks} className="btn-green flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Saving" : "Save payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordLimit, setRecordLimit] = useState(100);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ search: "", contactId: "", invoiceId: "", method: "", status: "", dateFrom: "", dateTo: "" });
  const [message, setMessage] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [aggregates, setAggregates] = useState(null);
  const [aggregateError, setAggregateError] = useState("");
  const [aggregateRetry, setAggregateRetry] = useState(0);
  const today = useChicagoDate();

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribePayments = onSnapshot(query(collection(db, "payments"), limit(recordLimit)), (snapshot) => {
      setPayments(snapshot.docs.map(financialRecord));
      setLoading(false);
    }, () => { setMessage("Payments could not load. Refresh to retry."); setLoading(false); });
    const unsubscribeInvoices = onSnapshot(query(collection(db, "invoices"), limit(recordLimit)), (snapshot) => setInvoices(snapshot.docs.map(financialRecord)), () => setMessage("Invoices could not load. Use Load more / retry before linking a payment."));
    getDocs(query(collection(db, "contacts"), limit(recordLimit))).then((snapshot) => setContacts(snapshot.docs.map(financialRecord))).catch(() => setMessage("Clients could not load. Use Load more / retry."));
    return () => { unsubscribePayments(); unsubscribeInvoices(); };
  }, [recordLimit]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let active = true;
    setAggregates(null); setAggregateError("");
    adminRequest('/api/summary', { action: 'summary.payments' }).then(result => {
      const value = result.paymentAggregates;
      if (!value?.complete || value.scope !== 'all-records' || !value.includesArchived || value.timeZone !== 'America/Chicago' || !Number.isFinite(value.receivedThisMonth) || !Number.isFinite(value.receivedAllTime)) throw new Error('Complete account payment totals are unavailable.');
      if (active) setAggregates(value);
    }).catch(error => { if (active) setAggregateError(error.message); });
    return () => { active = false; };
  }, [payments, aggregateRetry, today]);

  async function removePayment(payment) {
    const reason = window.prompt(`${payment.archivedAt ? "Restore" : "Archive"} this payment? Its financial effect is unchanged. Use Reversed to reverse a payment.\nReason (optional):`, "");
    if (reason === null) return;
    try { await archivePaymentRecord(payment, reason); } catch (error) { setMessage(error.message); }
  }

  async function importLegacyPayments() {
    setMessage("Legacy migration requires an approved backup and the offline finance-maintenance tool. It is not run from the browser.");
  }

  const [showArchived, setShowArchived] = useState(false);
  const filtered = useMemo(() => filterPayments(payments.filter(p => Boolean(p.archivedAt) === showArchived), filters), [payments, filters, showArchived]);
  const total = filtered.filter((payment) => payment.status === "received").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (!isFirebaseConfigured) return <NotConfigured feature="Payments" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800">Payments</h1><p className="mt-1 text-sm text-slate-500">Track money received and keep invoice balances current.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={importLegacyPayments} disabled={migrating} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Upload size={16} />{migrating ? "Importing" : "Migration guidance"}</button>
          <button onClick={() => setEditing({})} className="btn-green flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold"><Plus size={16} />Log payment</button>
        </div>
      </header>

      {message && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700" role="status">{message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-dark rounded-xl p-5"><p className="text-sm text-slate-500">Received this month · account</p><p className="mt-2 text-2xl font-bold text-emerald-600">{aggregates ? money(aggregates.receivedThisMonth) : aggregateError ? "Unavailable" : "Loading…"}</p></div>
        <div className="card-dark rounded-xl p-5"><p className="text-sm text-slate-500">Received all time · account</p><p className="mt-2 text-2xl font-bold text-slate-800">{aggregates ? money(aggregates.receivedAllTime) : aggregateError ? "Unavailable" : "Loading…"}</p></div>
        <div className="card-dark rounded-xl p-5"><p className="text-sm text-slate-500">Received subtotal · loaded and filtered</p><p className="mt-2 text-2xl font-bold text-slate-800">{money(total)}</p></div>
        <div className="card-dark rounded-xl p-5"><p className="text-sm text-slate-500">Records · loaded and filtered</p><p className="mt-2 text-2xl font-bold text-slate-800">{filtered.length}</p></div>
      </div>
      <p className="text-sm text-slate-500">Account totals include archived received payments across all pages and filters. The month uses America/Chicago{aggregates?.month ? ` (${aggregates.month})` : ""}. <button onClick={() => setAggregateRetry(value => value + 1)}>Refresh account totals</button></p>
      {aggregateError && <p role="alert" className="text-sm text-red-700">{aggregateError} <button onClick={() => setAggregateRetry(value => value + 1)}>Retry account totals</button></p>}

      <section className="card-dark rounded-xl p-4" aria-label="Payment filters">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
          <label className="relative lg:col-span-2"><span className="sr-only">Search payments</span><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="input-dark w-full rounded-lg py-2.5 pl-9 pr-3 text-sm" placeholder="Search client, reference, or notes" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></label>
          <select aria-label="Filter by client" className="input-dark rounded-lg px-3 py-2.5 text-sm" value={filters.contactId} onChange={(event) => setFilters((current) => ({ ...current, contactId: event.target.value }))}><option value="">All clients</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company}</option>)}</select>
          <select aria-label="Filter by method" className="input-dark rounded-lg px-3 py-2.5 text-sm" value={filters.method} onChange={(event) => setFilters((current) => ({ ...current, method: event.target.value }))}><option value="">All methods</option>{PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select>
          <select aria-label="Filter by status" className="input-dark rounded-lg px-3 py-2.5 text-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{PAYMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
          <select aria-label="Filter by invoice link" className="input-dark rounded-lg px-3 py-2.5 text-sm" value={filters.invoiceId} onChange={(event) => setFilters((current) => ({ ...current, invoiceId: event.target.value }))}><option value="">All invoice links</option><option value="linked">Linked</option><option value="unlinked">Not linked</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber}</option>)}</select>
          <button onClick={() => setFilters({ search: "", contactId: "", invoiceId: "", method: "", status: "", dateFrom: "", dateTo: "" })} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm text-slate-500 hover:bg-slate-50">Clear filters</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={16} />From<input type="date" className="input-dark rounded-lg px-2 py-2" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
          <label className="flex items-center gap-2 text-sm text-slate-500">To<input type="date" className="input-dark rounded-lg px-2 py-2" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        </div>
      </section>

      <p className="text-sm">The table, record count, and filtered subtotal cover loaded records.</p><button onClick={() => setRecordLimit(n => n + 100)}>Load more / retry payments, clients, and invoices</button>
      <label className="flex gap-2"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Show archived payments (still included in financial totals)</label>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? <div className="grid place-items-center py-20"><Loader2 className="animate-spin text-blue-500" /></div> : filtered.length === 0 ? <div className="grid place-items-center gap-2 py-20 text-center"><CircleDollarSign size={40} className="text-slate-200" /><p className="text-sm text-slate-500">No payments match these filters.</p></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((payment) => { const invoice = invoices.find((entry) => entry.id === payment.invoiceId); return <tr key={payment.id} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-600">{payment.paymentDate}</td><td className="px-4 py-3 font-medium text-slate-800">{payment.contactName}</td><td className="px-4 py-3 text-slate-600">{paymentMethodLabel(payment.method)}</td><td className="px-4 py-3 text-slate-600">{paymentStatusLabel(payment.status)}</td><td className="px-4 py-3 text-slate-500">{invoice?.invoiceNumber || "Not linked"}</td><td className="max-w-48 truncate px-4 py-3 text-slate-500" title={payment.reference || payment.notes}>{payment.reference || payment.notes || "None"}</td><td className={`px-4 py-3 text-right font-bold ${payment.status === "received" ? "text-emerald-600" : "text-slate-500"}`}>{money(payment.amount)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => setEditing(payment)} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600" aria-label={`Edit payment from ${payment.contactName}`}><Edit2 size={16} /></button><button onClick={() => removePayment(payment)} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`${payment.archivedAt ? "Restore" : "Archive"} payment from ${payment.contactName}`}><Trash2 size={16} /></button></div></td></tr>; })}</tbody></table></div>
        )}
      </section>

      {editing && <PaymentForm payment={editing.id ? editing : null} contacts={contacts} invoices={invoices} onClose={() => setEditing(null)} />}
    </div>
  );
}
