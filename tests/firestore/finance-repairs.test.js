import { createRequire } from 'node:module';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
const require = createRequire(import.meta.url);
const admin = require('../../HSP CRM/functions/node_modules/firebase-admin');
const { execute: finance } = require('../../HSP CRM/functions/handlers/finance');
const { reservationId, planInvoiceNumberBackfill } = require('../../HSP CRM/functions/handlers/finance-numbers');
let db, app;
const user = { uid: 'repair-admin', email: 'repair@example.test' };
const request = (action, data, rest = {}) => ({ action, data, requestId: crypto.randomUUID(), ...rest });
const invoiceData = contactId => ({ contactId, invoiceNumber: `TEST-${crypto.randomUUID()}`, clientName: 'Repair Client', issueDate: '2026-09-01', dueDate: '2026-09-15', items: [{ description: 'Care', qty: 1, rate: 150 }], status: 'sent' });
const paymentData = (contactId, invoiceId, amount = 200) => ({ contactId, invoiceId, amount, paymentDate: '2026-09-07', method: 'check', status: 'received' });
const get = async (collection, id) => (await db.collection(collection).doc(id).get()).data();
const events = async id => (await db.collection('activity').where('entityId', '==', id).get()).docs.map(doc => doc.data());
async function setup() {
  const clientId = `client-${crypto.randomUUID()}`;
  await db.collection('contacts').doc(clientId).set({ firstName: 'Repair', lastName: 'Client' });
  const invoice = await finance(db, user, request('invoice.save', invoiceData(clientId)));
  const payment = await finance(db, user, request('payment.save', paymentData(clientId, invoice.id)));
  return { clientId, invoice, payment };
}
async function adjusted() {
  const result = await setup();
  const invoice = await get('invoices', result.invoice.id);
  await finance(db, user, request('invoice.save', { ...invoice, correctedAmountPaid: 50, correctionReason: 'Verified duplicate receipt adjustment' }, { id: result.invoice.id, expectedVersion: invoice.version }));
  return { ...result, current: await get('invoices', result.invoice.id) };
}
beforeAll(() => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required. Never run against production.');
  app = admin.initializeApp({ projectId: `demo-finance-repairs-${Date.now()}` }, `finance-repairs-${Date.now()}`);
  db = app.firestore();
});
afterAll(async () => { await db?.terminate(); await app?.delete(); });

describe('actual finance handler repair regressions', () => {
  it('isolates invalid archived legacy numbers from unrelated financial saves', async () => {
    await db.collection('invoices').doc('invalid-number').set({ invoiceNumber: 'ß'.repeat(80), archivedAt: 1 });
    const { invoice } = await setup();
    const current = await get('invoices', invoice.id);
    await finance(db, user, request('invoice.save', { ...current, correctedAmountPaid: 100, correctionReason: 'Verified partial receipt' }, { id: invoice.id, expectedVersion: current.version }));
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 100 });
    expect(planInvoiceNumberBackfill([{ id: 'invalid-number', invoiceNumber: 'ß'.repeat(80) }]).issues).toEqual([expect.objectContaining({ type: 'invalid-number', invoiceId: 'invalid-number' })]);
  });
  it('clears the legacy alias when explicitly unlinking an invoice without payments', async () => {
    const clientId = `legacy-client-${crypto.randomUUID()}`;
    await db.collection('contacts').doc(clientId).set({ firstName: 'Legacy' });
    const invoice = await finance(db, user, request('invoice.save', invoiceData(clientId)));
    await db.collection('invoices').doc(invoice.id).update({ clientId, contactId: admin.firestore.FieldValue.delete() });
    const old = await get('invoices', invoice.id);
    await finance(db, user, request('invoice.save', { ...old, contactId: '' }, { id: invoice.id, expectedVersion: old.version }));
    const unlinked = await get('invoices', invoice.id);
    expect(unlinked).toMatchObject({ contactId: '', clientId: '' });
    await finance(db, user, request('invoice.save', { ...unlinked, notes: 'Saved after reopening' }, { id: invoice.id, expectedVersion: unlinked.version }));
    expect(await get('invoices', invoice.id)).toMatchObject({ contactId: '', clientId: '' });
    expect(await events(invoice.id)).toEqual(expect.arrayContaining([expect.objectContaining({ clientId, before: expect.objectContaining({ clientId }), after: expect.objectContaining({ clientId: '', contactId: '' }) })]));
  });
  it('allocates above normalized legacy numbers even when the counter is already stale', async () => {
    const clientId = 'number-client';
    await db.collection('contacts').doc(clientId).set({ firstName: 'Numbers' });
    await db.collection('invoices').doc('legacy-number').set({ invoiceNumber: ' inv-0041 ', clientId, archivedAt: 1 });
    await db.collection('_counters').doc('invoices').set({ value: 2 });
    const saved = await finance(db, user, request('invoice.save', { ...invoiceData(clientId), invoiceNumber: '' }));
    expect(saved.invoiceNumber).toBe('INV-0042');
    expect(await get('_invoiceNumbers', reservationId(' inv-0042 '))).toMatchObject({ invoiceId: saved.id, normalizedNumber: 'INV-0042' });
    await expect(finance(db, user, request('invoice.save', { ...invoiceData(clientId), invoiceNumber: 'INV-0041' }))).rejects.toThrow('already exists');
  });
  it('serializes differently formatted custom numbers and retries only once', async () => {
    const bodies = [' custom  ＮＵＭＢＥＲ ', 'CUSTOM NUMBER'].map(invoiceNumber => request('invoice.save', { ...invoiceData('number-client'), invoiceNumber }));
    const outcomes = await Promise.allSettled(bodies.map(body => finance(db, user, body)));
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    const winner = outcomes.findIndex(result => result.status === 'fulfilled');
    expect(await finance(db, user, bodies[winner])).toEqual(outcomes[winner].value);
    expect(await events(outcomes[winner].value.id)).toHaveLength(1);
  });
  it('allows metadata, amount corrections, and reversal with archived retained links', async () => {
    const { clientId, invoice, payment } = await setup();
    await db.collection('contacts').doc(clientId).update({ archivedAt: 1 });
    const current = await get('invoices', invoice.id);
    await finance(db, user, request('invoice.archive', { correctionReason: 'Client closed' }, { id: invoice.id, expectedVersion: current.version }));
    const edit = await finance(db, user, request('payment.save', { ...paymentData(clientId, invoice.id, 175), notes: 'Corrected deposit' }, { id: payment.id, expectedVersion: payment.version }));
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 175, creditAmount: 25 });
    await finance(db, user, request('payment.save', { ...paymentData(clientId, invoice.id, 175), status: 'reversed', correctionReason: 'Check returned' }, { id: payment.id, expectedVersion: edit.version }));
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 0, balanceDue: 150 });
    expect(await get('payments', payment.id)).toMatchObject({ contactId: clientId, invoiceId: invoice.id, status: 'reversed' });
    expect(await events(payment.id)).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'payment.reverse', reason: 'Check returned', actor: user.uid })]));
  });
  it('rejects new archived links while allowing an existing archived invoice to be unlinked', async () => {
    const { clientId, invoice, payment } = await setup();
    const otherInvoice = await finance(db, user, request('invoice.save', invoiceData(clientId)));
    await db.collection('contacts').doc(clientId).update({ archivedAt: 1 });
    await db.collection('invoices').doc(invoice.id).update({ archivedAt: 1 });
    await expect(finance(db, user, request('payment.save', paymentData(clientId, invoice.id)))).rejects.toThrow('active client');
    await expect(finance(db, user, request('payment.save', paymentData(clientId, otherInvoice.id), { id: payment.id, expectedVersion: payment.version }))).rejects.toThrow('active invoice');
    await expect(finance(db, user, request('invoice.save', invoiceData(clientId)))).rejects.toThrow('active client');
    const current = await get('invoices', invoice.id);
    await finance(db, user, request('invoice.save', { ...current, notes: 'Archived billing correction' }, { id: invoice.id, expectedVersion: current.version }));
    await finance(db, user, request('payment.save', paymentData(clientId, ''), { id: payment.id, expectedVersion: payment.version }));
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 0, balanceDue: 150, archivedAt: 1 });
  });
  it('rejects a new link to an archived invoice for an active client and another client’s invoice', async () => {
    const left = await setup(), right = await setup();
    await db.collection('invoices').doc(left.invoice.id).update({ archivedAt: 1 });
    await expect(finance(db, user, request('payment.save', paymentData(left.clientId, left.invoice.id)))).rejects.toThrow('active invoice');
    await expect(finance(db, user, request('payment.save', paymentData(left.clientId, right.invoice.id), { id: left.payment.id, expectedVersion: left.payment.version }))).rejects.toThrow('active invoice');
  });
  it('rolls back reversal conflicts and requires an explicit reasoned reconciliation', async () => {
    const { clientId, invoice, payment, current } = await adjusted();
    const data = { ...paymentData(clientId, invoice.id), status: 'reversed' };
    const beforeEvents = (await events(invoice.id)).length;
    await expect(finance(db, user, request('payment.save', data, { id: payment.id, expectedVersion: payment.version }))).rejects.toThrow('negative balance adjustment');
    for (const correction of [
      { invoiceId: invoice.id, expectedVersion: current.version, correctedAmountPaid: 0, reason: '' },
      { invoiceId: invoice.id, expectedVersion: current.version, correctedAmountPaid: '', reason: 'Verified' },
      { invoiceId: invoice.id, expectedVersion: current.version - 1, correctedAmountPaid: 0, reason: 'Verified' },
      { invoiceId: 'unrelated', expectedVersion: 0, correctedAmountPaid: 0, reason: 'Verified' },
    ]) await expect(finance(db, user, request('payment.save', { ...data, invoiceReconciliations: [correction] }, { id: payment.id, expectedVersion: payment.version }))).rejects.toThrow();
    expect(await get('payments', payment.id)).toMatchObject({ status: 'received', version: payment.version });
    expect(await get('invoices', invoice.id)).toMatchObject({ adjustmentCents: -15000, amountPaid: 50, version: current.version });
    expect(await events(invoice.id)).toHaveLength(beforeEvents);
    const body = request('payment.save', { ...data, invoiceReconciliations: [{ invoiceId: invoice.id, expectedVersion: current.version, correctedAmountPaid: 0, reason: 'Returned receipt; remove overlapping adjustment' }] }, { id: payment.id, expectedVersion: payment.version });
    const result = await finance(db, user, body);
    expect(await finance(db, user, body)).toEqual(result);
    expect(await get('invoices', invoice.id)).toMatchObject({ adjustmentCents: 0, amountPaid: 0, balanceDue: 150, receivedCents: 0, version: current.version + 1 });
    expect(await events(invoice.id)).toHaveLength(beforeEvents + 1);
    const event = (await events(invoice.id)).find(event => event.action === 'invoice.reconcile');
    expect(event).toMatchObject({ entityId: invoice.id, paymentId: payment.id, actor: user.uid, reason: 'Returned receipt; remove overlapping adjustment' });
    expect(event.details).toContain('Balance adjustment: $-150.00 → $0.00');
  });
  it('updates both affected invoices atomically on payment reassignment', async () => {
    const { clientId, invoice, payment, current } = await adjusted();
    const target = await finance(db, user, request('invoice.save', invoiceData(clientId)));
    const sourceCorrection = { invoiceId: invoice.id, expectedVersion: current.version, correctedAmountPaid: 0, reason: 'Receipt reassigned; remove original adjustment' };
    const targetCorrection = { invoiceId: target.id, expectedVersion: 0, correctedAmountPaid: 200, reason: 'Verified destination balance' };
    const data = { ...paymentData(clientId, target.id), invoiceReconciliations: [sourceCorrection, targetCorrection] };
    await expect(finance(db, user, request('payment.save', data, { id: payment.id, expectedVersion: payment.version }))).rejects.toThrow('changed');
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 50, version: current.version });
    expect(await get('invoices', target.id)).toMatchObject({ amountPaid: 0, version: target.version });
    expect(await get('payments', payment.id)).toMatchObject({ invoiceId: invoice.id, version: payment.version });
    targetCorrection.expectedVersion = target.version;
    await finance(db, user, request('payment.save', data, { id: payment.id, expectedVersion: payment.version }));
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 0, adjustmentCents: 0, balanceDue: 150 });
    expect(await get('invoices', target.id)).toMatchObject({ amountPaid: 200, creditAmount: 50 });
  });
  it('detects a concurrent invoice change before applying a reviewed reversal', async () => {
    const { clientId, invoice, payment, current } = await adjusted();
    await finance(db, user, request('payment.save', paymentData(clientId, invoice.id, 25)));
    await expect(finance(db, user, request('payment.save', { ...paymentData(clientId, invoice.id), status: 'reversed', invoiceReconciliations: [{ invoiceId: invoice.id, expectedVersion: current.version, correctedAmountPaid: 25, reason: 'Verified prior ledger' }] }, { id: payment.id, expectedVersion: payment.version }))).rejects.toThrow('changed');
    expect(await get('payments', payment.id)).toMatchObject({ status: 'received' });
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 75 });
  });
  it('keeps legacy client identity through invoice and payment archive/restore events', async () => {
    const { clientId, invoice, payment } = await setup();
    for (const [collection, record] of [['invoices', invoice], ['payments', payment]]) {
      await db.collection(collection).doc(record.id).update({ clientId, contactId: admin.firestore.FieldValue.delete() });
      const current = await get(collection, record.id);
      const type = collection === 'invoices' ? 'invoice' : 'payment';
      const archived = await finance(db, user, request(`${type}.archive`, { correctionReason: 'Closed file' }, { id: record.id, expectedVersion: current.version }));
      await finance(db, user, request(`${type}.archive`, { archived: false, correctionReason: 'Correction requested' }, { id: record.id, expectedVersion: archived.version }));
      const activity = await events(record.id);
      for (const action of [`${type}.archive`, `${type}.restore`]) expect(activity).toEqual(expect.arrayContaining([expect.objectContaining({ action, actor: user.uid, actorName: user.email, entityId: record.id, contactId: clientId, clientId })]));
      expect(activity.find(event => event.action === `${type}.restore`).details).toContain('Archived: Yes → No');
    }
    const oldPayment = await get('payments', payment.id);
    await finance(db, user, request('payment.save', { ...oldPayment, status: 'reversed' }, { id: payment.id, expectedVersion: oldPayment.version }));
    expect(await get('invoices', invoice.id)).toMatchObject({ amountPaid: 0, balanceDue: 150 });
  });
  it('reports a legacy number backfill without writing or selecting a duplicate owner', async () => {
    const id = `duplicate-${crypto.randomUUID()}`;
    await db.collection('invoices').doc(id).set({ invoiceNumber: ' INV-0041 ', clientId: 'number-client' });
    const [invoices, reservations] = await Promise.all(['invoices', '_invoiceNumbers'].map(collection => db.collection(collection).get()));
    const report = planInvoiceNumberBackfill(invoices.docs.map(doc => ({ ...doc.data(), id: doc.id })), reservations.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    expect(report.issues).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'duplicate-number', normalizedNumber: 'INV-0041' })]));
    expect(report.proposals.some(proposal => proposal.invoiceId === id || proposal.invoiceId === 'legacy-number')).toBe(false);
    expect((await db.collection('_invoiceNumbers').get()).size).toBe(reservations.size);
    expect(await get('invoices', id)).toEqual({ invoiceNumber: ' INV-0041 ', clientId: 'number-client' });
  });
});
