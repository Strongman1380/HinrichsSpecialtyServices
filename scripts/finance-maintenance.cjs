// Local operator tool. Defaults to read-only; never invoked by the public CRM.
const admin = require('../HSP CRM/functions/node_modules/firebase-admin');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { paymentFields, cents } = require('../HSP CRM/functions/handlers/finance-model');
const { planInvoiceNumberBackfill } = require('../HSP CRM/functions/handlers/finance-numbers');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const backupAt = args.indexOf('--backup');
const projectId = process.env.GCLOUD_PROJECT || 'hsp-crm';
if (apply && process.env.HSST_RECONCILIATION_APPROVED !== 'yes') throw new Error('Apply requires a reviewed backup and HSST_RECONCILIATION_APPROVED=yes.');
function normalizedLegacy(record) {
  return paymentFields({ ...record.data, contactId: record.contactId, status: record.data.status || 'received', method: record.data.method || 'other' });
}
async function importLegacy(db, record) {
  const reference = db.collection('payments').doc(`legacy_${crypto.createHash('sha256').update(record.sourceId).digest('hex')}`);
  const data = normalizedLegacy(record);
  return db.runTransaction(async tx => {
    const previous = await tx.get(db.collection('payments').where('legacySourceId', '==', record.sourceId));
    const deterministic = await tx.get(reference);
    const matches = previous.docs;
    if (matches.length > 1) throw new Error('Duplicate legacy source; manual review required.');
    const existing = matches[0] || (deterministic.exists ? deterministic : null);
    if (existing) {
      const value = existing.data();
      if (value.legacySourceId !== record.sourceId || Object.entries(data).some(([key, expected]) => value[key] !== expected)) throw new Error('Imported payment differs from its legacy source; manual review required.');
      return false;
    }
    const invoiceRef = data.invoiceId ? db.collection('invoices').doc(data.invoiceId) : null;
    const invoice = invoiceRef ? await tx.get(invoiceRef) : null;
    if (invoiceRef && !invoice.exists) throw new Error('Legacy payment has a missing invoice; manual review required.');
    if (invoice?.exists && (invoice.data().contactId || invoice.data().clientId) !== data.contactId) throw new Error('Legacy payment and invoice clients differ; manual review required.');
    tx.create(reference, { ...data, contactName: record.contactName, legacySourceId: record.sourceId, createdAt: record.data.createdAt || admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), archivedAt: null, version: 0 });
    // Do not guess how legacy adjustments overlap imported payments. Freeze balance edits until reviewed.
    if (invoice?.exists) tx.update(invoiceRef, { accountingVersion: 1, reconciliationRequired: true, version: Number(invoice.data().version || 0) + 1 });
    tx.create(db.collection('activity').doc(), { entity: 'payments', entityId: reference.id, contactId: record.contactId, action: 'legacy.import', actor: 'approved-maintenance', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}
async function main(db) {
  const [contacts, payments, invoices, reservations] = await Promise.all(['contacts', 'payments', 'invoices', '_invoiceNumbers'].map(c => db.collection(c).get()));
  const invoiceNumberBackfill = planInvoiceNumberBackfill(invoices.docs.map(d => ({ ...d.data(), id: d.id })), reservations.docs.map(d => ({ ...d.data(), id: d.id })));
  // Number backfills are proposals only, even during a separately approved legacy payment import.
  if (args.includes('--invoice-numbers-only')) {
    if (apply) throw new Error('Invoice-number backfill is dry-run only. Review the report before any separately approved migration.');
    console.log(JSON.stringify(invoiceNumberBackfill, null, 2));
    return invoiceNumberBackfill;
  }
  const legacy = [];
  for (const client of contacts.docs) {
    const records = await client.ref.collection('payments').get();
    for (const record of records.docs) legacy.push({ path: record.ref.path, sourceId: `${client.id}/${record.id}`, data: record.data(), contactId: client.id, contactName: [client.data().firstName, client.data().lastName].filter(Boolean).join(' ') || client.data().company || 'Client' });
  }
  if (backupAt >= 0) {
    const directory = args[backupAt + 1];
    if (!directory || !path.isAbsolute(directory) || fs.existsSync(directory)) throw new Error('Choose a new absolute backup directory.');
    fs.mkdirSync(directory, { mode: 0o700 });
    const records = [...contacts.docs, ...payments.docs, ...invoices.docs, ...reservations.docs].map(d => ({ path: d.ref.path, data: d.data() }));
    fs.writeFileSync(path.join(directory, 'financial-records.json'), JSON.stringify({ projectId, createdAt: new Date().toISOString(), records, legacy }, null, 2), { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(path.join(directory, 'invoice-number-review.json'), JSON.stringify(invoiceNumberBackfill, null, 2), { mode: 0o600, flag: 'wx' });
  }
  if (apply && backupAt < 0) throw new Error('Every apply run requires --backup to a new private directory.');
  const existing = payments.docs.map(d => ({ id: d.id, ...d.data() }));
  const invalid = [], duplicateSources = [];
  let sourceTotal = 0, imported = 0;
  for (const record of legacy) {
    sourceTotal += cents(record.data.amount);
    const matches = existing.filter(p => p.legacySourceId === record.sourceId);
    if (matches.length > 1) duplicateSources.push(record.sourceId);
    try {
      const normalized = normalizedLegacy(record);
      if (matches.length && Object.entries(normalized).some(([key, expected]) => matches[0][key] !== expected)) throw new Error('Legacy mismatch');
      if (normalized.invoiceId && !invoices.docs.some(d => d.id === normalized.invoiceId && (d.data().contactId || d.data().clientId) === record.contactId)) throw new Error('Orphaned invoice');
    } catch { invalid.push(record.sourceId); }
  }
  if (invalid.length || duplicateSources.length) throw new Error(`Review required: ${invalid.length} invalid legacy records, ${duplicateSources.length} duplicate sources. No migration performed.`);
  if (apply) for (const record of legacy) {
    await importLegacy(db, record);
    imported++;
  }
  const current = apply ? (await db.collection('payments').get()).docs.map(d => d.data()) : existing;
  const migrated = current.filter(p => legacy.some(l => l.sourceId === p.legacySourceId));
  const migratedTotal = migrated.reduce((sum, p) => sum + cents(p.amount), 0);
  const latestInvoices = apply ? await db.collection('invoices').get() : invoices;
  const needsReconciliation = latestInvoices.docs.filter(d => d.data().accountingVersion !== 2).map(d => d.id);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', invoiceNumberBackfill, sourceCount: legacy.length, sourceTotalCents: sourceTotal, migratedCount: migrated.length, migratedTotalCents: migratedTotal, recordsVisitedForImport: imported, countMatches: migrated.length === legacy.length, totalMatches: sourceTotal === migratedTotal, invoicesRequiringReconciliation: needsReconciliation }, null, 2));
  if (apply && (migrated.length !== legacy.length || sourceTotal !== migratedTotal)) throw new Error('Reconciliation failed. Keep financial editing closed and review the backup.');
}
if (require.main === module) {
  admin.initializeApp({ projectId });
  const db = admin.firestore();
  main(db).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.terminate());
}
module.exports = { importLegacy, main };
