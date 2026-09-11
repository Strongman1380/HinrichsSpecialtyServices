const admin = require('firebase-admin');
const crypto = require('node:crypto');
const { verifyAdmin } = require('./auth');
const { applyCors } = require('./cors');
const { rejectOversizedJson } = require('./request-limits');
const { fail, cents, text, invoiceFields, paymentFields, receivedCents, paymentState } = require('./finance-model');
const { normalizeInvoiceNumber, reservationId, sequenceValue } = require('./finance-numbers');
const { financeActivity } = require('./finance-activity');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const id = value => { if (!/^[\w-]{1,200}$/.test(value || '')) fail('Invalid record identifier.'); return value; };
function conflict() { const e = new Error('This record changed. Close and reopen it before saving.'); e.status = 409; throw e; }
function checkVersion(record, expected) { if (Number(record.version || 0) !== expected) conflict(); }

async function execute(db, user, body) {
  const { action, data = {}, expectedVersion } = body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Invalid financial data.');
  const requestId = id(body.requestId);
  const receipt = db.collection('_financeRequests').doc(hash(`${user.uid}:${requestId}`));
  const fingerprint = hash(JSON.stringify({ action, id: body.id || '', data, expectedVersion: expectedVersion ?? null }));
  const collection = action?.startsWith('invoice.') ? 'invoices' : action?.startsWith('payment.') ? 'payments' : null;
  if (!collection || !['invoice.save', 'invoice.archive', 'payment.save', 'payment.archive'].includes(action)) fail('Unsupported financial operation.');
  const reference = body.id ? db.collection(collection).doc(id(body.id)) : db.collection(collection).doc();
  return db.runTransaction(async tx => {
    const prior = await tx.get(receipt);
    if (prior.exists) { if (prior.data().fingerprint !== fingerprint) conflict(); return prior.data().result; }
    const snapshot = await tx.get(reference);
    const old = snapshot.exists ? snapshot.data() : null;
    if (body.id && !old) fail('Record no longer exists.');
    if (old) checkVersion(old, expectedVersion);
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    const version = Number(old?.version || 0) + 1;
    let patch = {}, writes = [], invoiceEvents = [];
    const reason = text(data.correctionReason, 1000);
    const corrections = data.invoiceReconciliations ?? [];
    if (!Array.isArray(corrections) || corrections.length > 2 || (corrections.length && (action !== 'payment.save' || !old))) fail('Reconciliation must accompany an existing payment correction.');
    const reconciliations = new Map();
    for (const correction of corrections) {
      if (!correction || typeof correction !== 'object') fail('Invalid invoice reconciliation.');
      const invoiceId = id(correction.invoiceId);
      if (reconciliations.has(invoiceId) || !text(correction.reason, 1000) || !Number.isSafeInteger(correction.expectedVersion) || correction.expectedVersion < 0) fail('Each invoice reconciliation needs its reviewed version and a reason.');
      reconciliations.set(invoiceId, { ...correction, paidCents: cents(correction.correctedAmountPaid, 'Verified paid amount'), reason: text(correction.reason, 1000) });
    }
    if (action.endsWith('.archive')) {
      if (!old) fail('Record no longer exists.');
      patch = { archivedAt: data.archived === false ? null : stamp, archivedBy: data.archived === false ? null : user.uid };
    } else if (collection === 'invoices') {
      patch = invoiceFields(data);
      const payments = await tx.get(db.collection('payments').where('invoiceId', '==', reference.id));
      const received = payments.docs.reduce((sum, d) => sum + receivedCents(d.data()), 0);
      let adjustment = Number(old?.adjustmentCents || 0);
      if (data.correctedAmountPaid !== undefined) {
        if (!reason) fail('Explain the administrative balance correction.');
        adjustment = cents(data.correctedAmountPaid) - received;
      } else if (old && (old.reconciliationRequired === true || (old.accountingVersion !== 2 && (cents(old.amountPaid || 0) !== received || (old.status === 'paid' && received < cents(old.total)))))) {
        fail('Legacy balance needs reconciliation. Enter the verified paid amount and a correction reason.');
      }
      if (old && patch.contactId !== (old.contactId || old.clientId || '') && payments.size) fail('An invoice with linked payments cannot be moved to a different client.');
      if (patch.contactId) {
        const client = await tx.get(db.collection('contacts').doc(id(patch.contactId)));
        if (!client.exists) fail('Client no longer exists.');
        if (client.data().archivedAt && patch.contactId !== (old?.contactId || old?.clientId)) fail('Choose an active client for a new invoice link.');
      }
      patch = { ...patch, ...paymentState(patch.totalCents, received, adjustment, data.status || old?.status || 'draft') };
      if (reason) patch.lastCorrectionReason = reason;
      const sequence = db.collection('_counters').doc('invoices');
      const counter = await tx.get(sequence);
      let next = Number(counter.data()?.value || 0);
      if (!Number.isSafeInteger(next) || next < 0) fail('Invoice counter requires review.');
      // Until the reviewed legacy backfill is approved, inspect every legacy number.
      // The shared counter serializes new allocations; canonical reservations protect custom numbers.
      const existing = await tx.get(db.collection('invoices').select('invoiceNumber'));
      const numbers = new Map();
      for (const doc of existing.docs) {
        const value = doc.data().invoiceNumber;
        if (typeof value !== 'string' || !value.trim()) continue;
        try {
          const key = normalizeInvoiceNumber(value);
          numbers.set(doc.id, key);
          next = Math.max(next, sequenceValue(key));
        } catch { /* Invalid legacy numbers are reported by the dry run, not assigned to new records. */ }
      }
      if (!Number.isSafeInteger(next + 1)) fail('Invoice sequence is exhausted.');
      const supplied = data.invoiceNumber;
      if (supplied !== undefined && typeof supplied !== 'string') fail('Invoice number must be text.');
      const number = old?.invoiceNumber || (supplied?.trim() ? normalizeInvoiceNumber(supplied) : `INV-${String(++next).padStart(4, '0')}`);
      const normalizedNumber = normalizeInvoiceNumber(number);
      if ([...numbers].some(([invoiceId, key]) => invoiceId !== reference.id && key === normalizedNumber)) fail('Invoice number already exists after normalization. Review the invoice-number dry run.');
      const numberRef = db.collection('_invoiceNumbers').doc(reservationId(normalizedNumber));
      const numberDoc = await tx.get(numberRef);
      if (numberDoc.exists && (numberDoc.data().invoiceId !== reference.id || (numberDoc.data().normalizedNumber && numberDoc.data().normalizedNumber !== normalizedNumber))) fail('Invoice number already exists or its reservation requires review.');
      patch.invoiceNumber = number;
      patch.invoiceNumberKey = normalizedNumber;
      next = Math.max(next, sequenceValue(normalizedNumber));
      writes.push([sequence, { value: next }], [numberRef, { invoiceId: reference.id, normalizedNumber }]);
    } else {
      patch = paymentFields({ ...data, contactId: data.contactId ?? (old?.contactId || old?.clientId || '') });
      const client = await tx.get(db.collection('contacts').doc(id(patch.contactId)));
      const retainedClient = patch.contactId === (old?.contactId || old?.clientId);
      if (!client.exists || (client.data().archivedAt && !retainedClient)) fail('Choose an active client.');
      patch.contactName = [client.data().firstName, client.data().lastName].filter(Boolean).join(' ') || client.data().company || 'Client';
      const affectedIds = [...new Set([old?.invoiceId, patch.invoiceId].filter(Boolean))];
      if ([...reconciliations.keys()].some(invoiceId => !affectedIds.includes(invoiceId))) fail('Only invoices affected by this payment may be reconciled.');
      for (const invoiceId of affectedIds) {
        const invoiceRef = db.collection('invoices').doc(id(invoiceId));
        const invoiceSnap = await tx.get(invoiceRef);
        if (!invoiceSnap.exists) { if (patch.invoiceId === invoiceId || reconciliations.has(invoiceId)) fail('The linked invoice no longer exists. Unlink or choose another invoice.'); continue; }
        const invoice = invoiceSnap.data();
        const retainedInvoice = old?.invoiceId === invoiceId && retainedClient;
        if (patch.invoiceId === invoiceId && ((invoice.contactId || invoice.clientId) !== patch.contactId || (!retainedInvoice && (invoice.archivedAt || client.data().archivedAt)))) fail('Choose an active invoice belonging to an active client. Existing archived links can be retained or removed.');
        const linked = await tx.get(db.collection('payments').where('invoiceId', '==', invoiceId));
        const before = linked.docs.reduce((sum, d) => sum + receivedCents(d.data()), 0);
        const reconciliation = reconciliations.get(invoiceId);
        if (!reconciliation && (invoice.reconciliationRequired === true || (invoice.accountingVersion !== 2 && (cents(invoice.amountPaid || 0) !== before || (invoice.status === 'paid' && before < cents(invoice.total)))))) fail('Reconcile the legacy invoice balance before changing linked payments, or include its verified paid amount and reason with this correction.');
        const received = linked.docs.filter(d => d.id !== reference.id).reduce((sum, d) => sum + receivedCents(d.data()), 0) + (patch.invoiceId === invoiceId ? receivedCents(patch) : 0);
        let adjustment = Number(invoice.adjustmentCents || 0);
        if (reconciliation) {
          checkVersion(invoice, reconciliation.expectedVersion);
          adjustment = reconciliation.paidCents - received;
        } else if (received + adjustment < 0) {
          fail(`Invoice ${invoice.invoiceNumber || invoiceId}: this payment correction conflicts with its negative balance adjustment. Include a verified paid amount after the change and a reconciliation reason.`);
        }
        const invoicePatch = { ...paymentState(cents(invoice.total), received, adjustment, invoice.status), version: Number(invoice.version || 0) + 1, updatedAt: stamp, ...(reconciliation ? { lastCorrectionReason: reconciliation.reason } : {}) };
        writes.push([invoiceRef, invoicePatch]);
        invoiceEvents.push(financeActivity({ entity: 'invoices', entityId: invoiceId, action: reconciliation ? 'invoice.reconcile' : 'invoice.payment_update', user, before: invoice, patch: invoicePatch, reason: reconciliation?.reason || reason, stamp, paymentId: reference.id }));
      }
    }
    // Keep legacy aliases synchronized when a financial record is explicitly moved or unlinked.
    // Activity retains the original clientId in its historical identity and before snapshot.
    if (!action.endsWith('.archive') && old && Object.hasOwn(old, 'clientId')) patch.clientId = patch.contactId;
    // All reads above precede every write, so retries see a consistent ledger.
    for (const [ref, value] of writes) tx.set(ref, value, { merge: true });
    tx.set(reference, { ...patch, version, updatedAt: stamp, ...(!old ? { createdAt: stamp, archivedAt: null } : {}) }, { merge: true });
    const result = { id: reference.id, version, invoiceNumber: patch.invoiceNumber || null };
    const eventAction = action.endsWith('.archive') && data.archived === false ? action.replace('.archive', '.restore') : action === 'payment.save' && old?.status !== 'reversed' && patch.status === 'reversed' ? 'payment.reverse' : action;
    tx.create(db.collection('activity').doc(), financeActivity({ entity: collection, entityId: reference.id, action: eventAction, user, before: old, patch, reason: reason || [...reconciliations.values()].map(value => value.reason).join('; '), stamp }));
    for (const event of invoiceEvents) tx.create(db.collection('activity').doc(), event);
    tx.create(receipt, { fingerprint, result, createdAt: stamp });
    return result;
  });
}
module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(cors ? 204 : 403).end();
  if (!cors) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (rejectOversizedJson(req, res, 100000)) return;
  try { return res.json(await execute(admin.firestore(), auth.user, req.body || {})); }
  catch (error) { console.error('[finance]', error.message); return res.status(error.status || 500).json({ error: error.status ? error.message : 'Financial operation failed. Retry with the same request.' }); }
};
module.exports.execute = execute;
