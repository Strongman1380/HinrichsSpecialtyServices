import { useDialog } from "../components/Dialog";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, query, limit } from "firebase/firestore";
import { Check, Copy, Edit2, FileText, Loader2, Mail, Plus, Printer, Trash2, X } from "lucide-react";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { apiUrl } from "../api";
import NotConfigured from "../components/NotConfigured";
import { money } from "../payment-utils";
import { createInvoiceRecord, archiveInvoiceRecord, updateInvoiceRecord } from "../invoice-service";
import { financialClientId, financialClientOptions, financialRecord } from "../finance-options";
import logo from "../../../images/hinrichs-specialty-services-logo.png";

const SERVICES = [
  { name: "Website Care + Build - monthly plan (includes up to 5 hours)", rate: 150 },
  { name: "Social Media Management - starting monthly scope", rate: 50 },
  { name: "Basic additional work - preapproved", rate: 30, isHourly: true },
  { name: "Standard additional work - preapproved", rate: 45, isHourly: true },
  { name: "Advanced additional work - preapproved", rate: 65, isHourly: true },
  { name: "Virtual assistance - approved scope", rate: 30, isHourly: true },
];

const STATUSES = [
  ["draft", "Draft"],
  ["sent", "Sent"],
  ["partially_paid", "Partially paid"],
  ["paid", "Paid"],
  ["overdue", "Overdue"],
];

function itemAmount(item) {
  const rate = Number(item.rate || 0);
  return item.isHourly ? (Number(item.hours || 0) + Number(item.minutes || 0) / 60) * rate : Number(item.qty || 1) * rate;
}

function totals(items, taxPct) {
  const subtotal = items.reduce((sum, item) => sum + Math.round(itemAmount(item) * 100), 0) / 100;
  const tax = Math.round(subtotal * Number(taxPct || 0)) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function newInvoice(number) {
  const issue = new Date();
  const due = new Date(issue);
  due.setDate(due.getDate() + 14);
  return {
    invoiceNumber: number,
    contactId: "",
    clientName: "",
    clientEmail: "",
    issueDate: issue.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    status: "draft",
    items: [{ description: SERVICES[0].name, rate: 150, qty: 1, isHourly: false, hours: 0, minutes: 0 }],
    taxPct: 0,
    amountPaid: 0,
    notes: "Month-to-month service. Additional work requires advance approval. Unused monthly hours do not roll over.",
  };
}

function InvoiceModal({ invoice, number, contacts, onClose, onSaved }) {
  useDialog(onClose);
  const [form, setForm] = useState(invoice ? {
    ...newInvoice(invoice.invoiceNumber || number),
    ...invoice,
    contactId: invoice.contactId || invoice.clientId || "",
    items: invoice.items?.map((item) => ({ ...item })) || [],
  } : newInvoice(number));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [correctionEnabled, setCorrectionEnabled] = useState(false);
  const [retainedContact, setRetainedContact] = useState(null);
  const knownContacts = retainedContact && !contacts.some(contact => contact.id === retainedContact.id) ? [...contacts, retainedContact] : contacts;
  const availableContacts = financialClientOptions(knownContacts, invoice);
  const calculated = totals(form.items, form.taxPct);
  const input = "input-dark w-full rounded-lg px-3 py-2.5 text-sm";

  useEffect(() => {
    const contactId = financialClientId(invoice);
    if (!contactId) return;
    let active = true;
    getDoc(doc(db, "contacts", contactId)).then(snapshot => {
      if (active && snapshot.exists()) setRetainedContact({ ...snapshot.data(), id: snapshot.id });
    }).catch(() => { if (active) setError("The existing client could not load. Its link will be retained unless you choose another client."); });
    return () => { active = false; };
  }, [invoice]);

  function set(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function chooseContact(contactId) {
    const contact = availableContacts.find((entry) => entry.id === contactId);
    setForm((current) => ({
      ...current,
      contactId,
      clientName: [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || contact?.company || "",
      clientEmail: contact?.email || "",
    }));
  }
  function updateItem(index, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }
  function addService(event) {
    const service = SERVICES[Number(event.target.value)];
    if (!service) return;
    setForm((current) => ({ ...current, items: [...current.items, { description: service.name, rate: service.rate, qty: 1, isHourly: Boolean(service.isHourly), hours: service.isHourly ? 1 : 0, minutes: 0 }] }));
    event.target.value = "";
  }
  async function save(event) {
    event.preventDefault();
    if (!form.clientName.trim()) return setError("Choose or enter a client.");
    if (!form.items.length || calculated.total <= 0) return setError("Add at least one billable item.");
    if (correctionEnabled && (!form.correctionReason?.trim() || form.amountPaid === "" || !Number.isFinite(Number(form.amountPaid)) || Number(form.amountPaid) < 0)) return setError("Enter the verified paid amount and a correction reason.");
    setSaving(true);
    try {
      const correction = correctionEnabled ? { correctedAmountPaid: Number(form.amountPaid), correctionReason: form.correctionReason } : {};
      const data = {
        invoiceNumber: form.invoiceNumber.trim(),
        contactId: form.contactId || "",
        clientName: form.clientName.trim().slice(0, 200),
        clientEmail: (form.clientEmail || "").trim().slice(0, 320),
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: form.status,
        items: form.items.map((item) => ({
          description: String(item.description || "").trim().slice(0, 500),
          rate: Math.max(0, Number(item.rate || 0)),
          qty: Math.max(1, Number(item.qty || 1)),
          isHourly: Boolean(item.isHourly),
          hours: Math.max(0, Number(item.hours || 0)),
          minutes: Math.min(59, Math.max(0, Number(item.minutes || 0))),
        })),
        taxPct: Math.max(0, Number(form.taxPct || 0)),
        ...calculated,
        ...correction,
        notes: String(form.notes || "").trim().slice(0, 5000),
      };
      if (invoice?.id) await updateInvoiceRecord(invoice.id, data, invoice.version || 0);
      else await createInvoiceRecord(data);
      onSaved(invoice?.id ? "Invoice updated." : "Invoice created.");
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Invoice could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="invoice-editor-title">
      <form onSubmit={save} className="my-6 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 id="invoice-editor-title" className="text-lg font-bold text-slate-800">{invoice ? "Edit invoice" : "New invoice"}</h2><button type="button" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">CRM client<select className={input} value={form.contactId || ""} onChange={(event) => chooseContact(event.target.value)}><option value="">Enter manually</option>{availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company}{contact.archivedAt ? " (archived — existing client)" : contact.retainedOnly ? " (existing client — not loaded)" : ""}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Invoice number<input className={input} value={form.invoiceNumber} onChange={(event) => set("invoiceNumber", event.target.value)} readOnly={Boolean(invoice)} maxLength={80} placeholder="Assigned when saved" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Status<select className={input} value={form.status} onChange={(event) => set("status", event.target.value)}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Client name<input className={input} value={form.clientName} onChange={(event) => set("clientName", event.target.value)} required /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Client email<input type="email" className={input} value={form.clientEmail || ""} onChange={(event) => set("clientEmail", event.target.value)} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Issue date<input type="date" className={input} value={form.issueDate} onChange={(event) => set("issueDate", event.target.value)} required /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Due date<input type="date" className={input} value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} required /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Tax percent<input type="number" min="0" step="0.01" className={input} value={form.taxPct} onChange={(event) => set("taxPct", event.target.value)} /></label>
          <label className="flex items-start gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><input type="checkbox" checked={correctionEnabled} onChange={event => setCorrectionEnabled(event.target.checked)} />Apply a verified balance correction</label>
          <div className="grid gap-1.5 text-sm font-medium text-slate-700"><label htmlFor="invoice-paid-correction">Amount paid correction</label><input id="invoice-paid-correction" type="number" min="0" step="0.01" className={input} value={form.amountPaid ?? 0} disabled={!correctionEnabled} required={correctionEnabled} onChange={(event) => set("amountPaid", event.target.value)} aria-describedby="amount-paid-help" /><span id="amount-paid-help" className="text-xs font-normal text-slate-400">Enable a correction and document the verified total. Regular edits preserve current payments.</span></div>
          {correctionEnabled && <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Correction reason<input className={input} required value={form.correctionReason || ""} onChange={event => set("correctionReason", event.target.value)} maxLength={1000} /></label>}
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Add approved service<select className={input} defaultValue="" onChange={addService}><option value="">Choose service</option>{SERVICES.map((service, index) => <option key={service.name} value={index}>{service.name} - {money(service.rate)}{service.isHourly ? "/hr" : ""}</option>)}</select></label>
        </div>

        <div className="space-y-3 border-y border-slate-200 bg-slate-50 px-6 py-5">
          {form.items.map((item, index) => <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_100px_170px_100px_44px]">
            <label className="grid gap-1 text-xs font-medium text-slate-500">Description<input className={input} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} required /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-500">Rate<input type="number" min="0" step="0.01" className={input} value={item.rate} onChange={(event) => updateItem(index, "rate", event.target.value)} /></label>
            {item.isHourly ? <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs font-medium text-slate-500">Hours<input type="number" min="0" className={input} value={item.hours || 0} onChange={(event) => updateItem(index, "hours", event.target.value)} /></label><label className="grid gap-1 text-xs font-medium text-slate-500">Minutes<input type="number" min="0" max="59" className={input} value={item.minutes || 0} onChange={(event) => updateItem(index, "minutes", event.target.value)} /></label></div> : <label className="grid gap-1 text-xs font-medium text-slate-500">Quantity<input type="number" min="1" className={input} value={item.qty || 1} onChange={(event) => updateItem(index, "qty", event.target.value)} /></label>}
            <div><p className="mb-2 text-xs font-medium text-slate-500">Amount</p><p className="py-2.5 text-right font-bold text-slate-700">{money(itemAmount(item))}</p></div>
            <button type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} className="mt-5 grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove item"><Trash2 size={16} /></button>
          </div>)}
          <button type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { description: "", rate: 0, qty: 1, isHourly: false }] }))} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"><Plus size={16} />Add custom item</button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1fr_300px]">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Notes and terms<textarea className={input} rows="4" value={form.notes || ""} onChange={(event) => set("notes", event.target.value)} /></label>
          <div className="rounded-xl bg-slate-900 p-5 text-white"><div className="flex justify-between text-sm text-slate-300"><span>Subtotal</span><span>{money(calculated.subtotal)}</span></div>{calculated.tax > 0 && <div className="mt-2 flex justify-between text-sm text-slate-300"><span>Tax</span><span>{money(calculated.tax)}</span></div>}<div className="mt-4 flex justify-between border-t border-white/20 pt-4 text-lg font-bold"><span>Total</span><span>{money(calculated.total)}</span></div></div>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2" role="alert">{error}</p>}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4"><button disabled={saving} className="btn-green flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? "Saving" : "Save invoice"}</button></div>
      </form>
    </div>
  );
}

function invoiceText(invoice) {
  const balance = Number(invoice.balanceDue ?? invoice.total ?? 0);
  return `Hi ${invoice.clientName || ""},\n\nInvoice ${invoice.invoiceNumber} is ready.\nBalance due: ${money(balance)}\nDue date: ${invoice.dueDate || "On receipt"}\n\nHSST accepts Venmo, Cash App, Zelle, check, wire, cash, or another agreed method. Reply to confirm your preferred method and receive the correct payment instructions.\n\nThank you,\nHinrichs Specialty Services and Technology\n(402) 759-2210`;
}

function printInvoice(invoice) {
  if (invoice.accountingVersion !== 2) { window.alert("Reconcile this legacy invoice before printing."); return; }
  const calculated = { total: Number(invoice.total), subtotal: Number(invoice.subtotal), tax: Number(invoice.tax) };
  const rows = (invoice.items || []).map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.isHourly ? `${item.hours || 0}h ${item.minutes || 0}m` : item.qty || 1)}</td><td>${escapeHtml(money(itemAmount(item)))}</td></tr>`).join("");
  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.opener = null;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(invoice.invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;color:#132e54;padding:40px;max-width:850px;margin:auto}header{display:flex;justify-content:space-between;gap:24px;align-items:start}img{width:120px;height:auto}h1{margin:0}table{width:100%;border-collapse:collapse;margin:32px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #dbe4ef}th:last-child,td:last-child{text-align:right}.totals{margin-left:auto;width:320px}.totals p{display:flex;justify-content:space-between}.balance{font-size:20px;font-weight:800}.payment{margin-top:32px;padding:20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px}.footer{margin-top:40px;color:#64748b;font-size:12px}@media print{body{padding:0}}</style></head><body><header><img src="${escapeHtml(logo)}" alt="HSST"><div><h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1><p>${escapeHtml(invoice.issueDate)}<br>Due ${escapeHtml(invoice.dueDate || "On receipt")}</p></div></header><section><h2>${escapeHtml(invoice.clientName)}</h2><p>${escapeHtml(invoice.clientEmail)}</p></section><table><thead><tr><th>Description</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><p><span>Subtotal</span><span>${escapeHtml(money(calculated.subtotal))}</span></p><p><span>Tax</span><span>${escapeHtml(money(calculated.tax))}</span></p><p><span>Total</span><span>${escapeHtml(money(calculated.total))}</span></p><p><span>Paid</span><span>${escapeHtml(money(invoice.amountPaid))}</span></p><p><span>Overpayment credit</span><span>${escapeHtml(money(invoice.creditAmount))}</span></p><p class="balance"><span>Balance due</span><span>${escapeHtml(money(invoice.balanceDue ?? calculated.total))}</span></p></div><div class="payment"><strong>Payment options</strong><p>Venmo, Cash App, Zelle, check, wire, cash, or another agreed method. Contact HSST for the correct payment instructions.</p></div>${invoice.notes ? `<p>${escapeHtml(invoice.notes)}</p>` : ""}<p class="footer">Hinrichs Specialty Services and Technology | (402) 759-2210 | bhinrichs1380@gmail.com</p><script>window.onload=function(){window.print()}<\/script></body></html>`);
  popup.document.close();
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordLimit, setRecordLimit] = useState(100);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [preparing, setPreparing] = useState("");
  const [deleting, setDeleting] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    getDocs(query(collection(db, "contacts"), limit(recordLimit))).then((snapshot) => setContacts(snapshot.docs.map(financialRecord))).catch(() => setMessage("Clients could not load. Use Load more / retry."));
    return onSnapshot(query(collection(db, "invoices"), limit(recordLimit)), (snapshot) => { setInvoices(snapshot.docs.map(financialRecord)); setLoading(false); }, () => { setMessage("Invoices could not load. Refresh to retry."); setLoading(false); });
  }, [recordLimit]);

  async function remove(invoice) {
    const reason = window.prompt(`${invoice.archivedAt ? "Restore" : "Archive"} invoice ${invoice.invoiceNumber}? Payments and outstanding debt will be preserved.\nReason (optional):`, "");
    if (reason === null) return;
    setDeleting(invoice.id);
    setMessage("");
    try {
      await archiveInvoiceRecord(invoice, reason);
      setMessage(invoice.archivedAt ? "Invoice restored." : "Invoice archived. Financial history is preserved.");
    } catch (error) {
      setMessage(error.message || "Invoice could not be deleted.");
    } finally {
      setDeleting("");
    }
  }

  async function changeStatus(invoice, status) {
    setUpdatingStatus(invoice.id);
    setMessage("");
    try {
      if (["paid", "partially_paid"].includes(status)) throw new Error("Record a payment, or edit the invoice with a documented balance correction.");
      await updateInvoiceRecord(invoice.id, { ...invoice, status }, invoice.version || 0);
      setMessage(`Invoice ${invoice.invoiceNumber} status updated.`);
    } catch (error) {
      setMessage(error.message || "Invoice status could not be updated.");
    } finally {
      setUpdatingStatus("");
    }
  }

  async function prepareEmail(invoice) {
    setPreparing(invoice.id);
    setMessage("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(apiUrl("/api/send-invoice"), { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ invoiceId: invoice.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Invoice email could not be prepared.");
      await navigator.clipboard.writeText(result.emailHtml);
      // Preparing a local email is not a sent invoice and does not alter financial state.
      setMessage("Invoice email HTML copied. Mark the invoice Sent after you send the email.");
      if (invoice.clientEmail) window.location.href = `mailto:${invoice.clientEmail}?subject=${encodeURIComponent(result.subject)}&body=${encodeURIComponent(result.emailText)}`;
    } catch (error) {
      setMessage(error.message || "Invoice email could not be prepared.");
    } finally {
      setPreparing("");
    }
  }

  const filtered = useMemo(() => invoices.filter((invoice) => filter === "archived" ? invoice.archivedAt : !invoice.archivedAt && (filter === "all" || invoice.status === filter)), [invoices, filter]);
  const unreconciled = invoices.some(invoice => invoice.accountingVersion !== 2);
  const summary = invoices.reduce((current, invoice) => ({ outstanding: current.outstanding + Number(invoice.balanceDue ?? invoice.total ?? 0), paid: current.paid + Number(invoice.amountPaid || 0) }), { outstanding: 0, paid: 0 });
  const nextNumber = "";

  function actions(invoice, showLabels = false) {
    return <div className="flex flex-wrap justify-end gap-1.5">
      <button onClick={() => prepareEmail(invoice)} disabled={preparing === invoice.id} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600" aria-label={`Prepare email for ${invoice.invoiceNumber}`} title="Prepare email">{preparing === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}</button>
      <button onClick={() => { if (invoice.accountingVersion !== 2) { setMessage("Reconcile this legacy invoice before copying payment instructions."); return; } navigator.clipboard.writeText(invoiceText(invoice)).then(() => setMessage("Invoice email text copied.")).catch(() => setMessage("Copy failed. Check clipboard access or use Print.")); }} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600" aria-label={`Copy email text for ${invoice.invoiceNumber}`} title="Copy email text"><Copy size={16} /></button>
      <button onClick={() => printInvoice(invoice)} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Print ${invoice.invoiceNumber}`} title="Print invoice"><Printer size={16} /></button>
      <button onClick={() => setEditing(invoice)} className="flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100" aria-label={`Edit ${invoice.invoiceNumber}`}><Edit2 size={16} />{showLabels && <span>Edit</span>}</button>
      <button onClick={() => remove(invoice)} disabled={deleting === invoice.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60" aria-label={`${invoice.archivedAt ? "Restore" : "Archive"} ${invoice.invoiceNumber}`}>{deleting === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}{showLabels && <span>{invoice.archivedAt ? "Restore" : "Archive"}</span>}</button>
    </div>;
  }

  if (!isFirebaseConfigured) return <NotConfigured feature="Invoices" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-800">Invoices</h1><p className="mt-1 text-sm text-slate-500">Create manual-payment invoices and track balances from recorded payments.</p></div><button onClick={() => setEditing({})} className="btn-green flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold"><Plus size={16} />New invoice</button></header>
      <p className="text-sm text-slate-600">Totals below cover loaded records. Use the dashboard for reconciled account-wide totals.</p>
      <button onClick={() => setRecordLimit(n => n + 100)}>Load more / retry invoices and clients</button>
      <button onClick={() => setFilter(filter === "archived" ? "all" : "archived")}>{filter === "archived" ? "Show active invoices" : "Show archived invoices"}</button>
      {message && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700" role="status">{message}</p>}
      <div className="grid gap-4 sm:grid-cols-3"><div className="card-dark rounded-xl p-5"><p className="text-sm text-slate-500">Outstanding</p><p className="mt-2 text-2xl font-bold text-orange-600">{unreconciled ? "Review required" : money(summary.outstanding)}</p></div><div className="card-dark rounded-xl p-5"><p className="text-sm text-slate-500">Payments applied</p><p className="mt-2 text-2xl font-bold text-emerald-600">{unreconciled ? "Review required" : money(summary.paid)}</p></div><div className="card-dark rounded-xl p-5"><p className="text-sm text-slate-500">Invoices</p><p className="mt-2 text-2xl font-bold text-slate-800">{invoices.length}</p></div></div>
      <div className="flex flex-wrap gap-2">{[["all", "All"], ...STATUSES].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${filter === value ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>{label}</button>)}</div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-blue-500" /></div> : filtered.length === 0 ? <div className="grid min-h-64 place-items-center gap-2 text-center"><FileText size={40} className="text-slate-200" /><p className="text-sm text-slate-500">No invoices match this filter.</p></div> : <>
          <div className="grid gap-3 p-3 md:hidden">{filtered.map((invoice) => <article key={invoice.id} className="rounded-xl border border-slate-200 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{invoice.invoiceNumber}</p><p className="text-sm text-slate-500">{invoice.clientName || "No client"}</p></div><p className="text-right text-sm font-bold text-orange-600">{money(invoice.balanceDue ?? invoice.total)}<span className="block text-xs font-normal text-slate-400">balance</span></p></div><div className="my-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-400">Due</p><p className="text-slate-700">{invoice.dueDate || "Not set"}</p></div><div><label className="text-xs text-slate-400" htmlFor={`mobile-status-${invoice.id}`}>Status</label><select id={`mobile-status-${invoice.id}`} className="input-dark mt-1 min-h-11 w-full rounded-lg px-2 text-xs" value={invoice.status || "draft"} disabled={updatingStatus === invoice.id} onChange={(event) => changeStatus(invoice, event.target.value)}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>{actions(invoice, true)}</article>)}</div>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Manage</th></tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-700">{invoice.invoiceNumber}</td><td className="px-4 py-3 text-slate-700">{invoice.clientName}</td><td className="px-4 py-3 text-slate-500">{invoice.dueDate}</td><td className="px-4 py-3"><select aria-label={`Status for ${invoice.invoiceNumber}`} className="input-dark min-h-11 rounded-lg px-2 text-xs" value={invoice.status || "draft"} disabled={updatingStatus === invoice.id} onChange={(event) => changeStatus(invoice, event.target.value)}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="px-4 py-3 text-right font-semibold text-slate-700">{money(invoice.total)}</td><td className="px-4 py-3 text-right font-bold text-orange-600">{money(invoice.balanceDue ?? invoice.total)}</td><td className="px-4 py-3">{actions(invoice, true)}</td></tr>)}</tbody></table></div>
        </>}
      </section>
      {editing && <InvoiceModal invoice={editing.id ? editing : null} number={nextNumber} contacts={contacts} onClose={() => setEditing(null)} onSaved={setMessage} />}
    </div>
  );
}
