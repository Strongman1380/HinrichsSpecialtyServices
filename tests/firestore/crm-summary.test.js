import { createRequire } from 'node:module';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
const require = createRequire(import.meta.url);
const admin = require('../../HSP CRM/functions/node_modules/firebase-admin');
const { getSummary, queuePage } = require('../../HSP CRM/functions/handlers/summary');
let app, db;
const today = '2026-08-31';
const archivedAt = new Date('2026-01-01T12:00:00Z');
beforeAll(async () => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local Firestore emulator required; production is forbidden.');
  const name = `demo-summary-${crypto.randomUUID().slice(0, 8)}`;
  app = admin.initializeApp({ projectId: name }, name); db = app.firestore();
  const rows = [];
  for (let index = 0; index < 140; index++) {
    const id = `a-${String(index).padStart(3, '0')}`;
    rows.push(['tasks', id, { title: 'Archived task', status: 'todo', dueDate: '2026-08-01', archivedAt }]);
    rows.push(['contacts', id, { status: 'client', followUpDate: '2026-08-01', archivedAt }]);
    rows.push(['invoices', id, { accountingVersion: 2, balanceDue: 0, total: 150, dueDate: '2026-08-01', status: 'paid' }]);
    rows.push(['servicePlans', id, { contactId: id, startDate: '2026-01-01', usageByPeriod: { '2026-08-01': 10 } }]);
    rows.push(['payments', id, { amount: 0.1, status: 'received', paymentDate: '2026-08-31', archivedAt }]);
  }
  for (let index = 0; index < 4; index++) {
    const id = `z-${index}`;
    rows.push(['tasks', id, { title: id, status: 'doing', dueDate: '2026-08-02', ...(index ? { archivedAt: null } : {}) }]);
    rows.push(['contacts', id, { firstName: id, status: 'client', followUpDate: '2026-08-02' }]);
    rows.push(['invoices', id, { accountingVersion: 2, balanceDue: 50, total: 150, dueDate: '2026-08-02', ...(index ? {} : { archivedAt }) }]);
    rows.push(['servicePlans', id, { contactId: id, startDate: '2026-01-31', usageByPeriod: { '2026-08-31': 270 } }]);
  }
  rows.push(['invoices', 'legacy-paid', { status: 'paid', total: 150, dueDate: '2026-08-01' }]);
  rows.push(['invoices', 'legacy-partial', { amountPaid: 120, total: 150, dueDate: '2026-08-03' }]);
  rows.push(['invoices', 'no-due-date', { accountingVersion: 2, balanceDue: 20, dueDate: '' }]);
  rows.push(['invoices', 'flagged', { accountingVersion: 2, reconciliationRequired: true, balanceDue: 0 }]);
  rows.push(['tasks', 'done', { status: 'done', dueDate: '2026-08-01' }]);
  rows.push(['contacts', 'future', { status: 'lead', followUpDate: '2026-09-01' }]);
  rows.push(['servicePlans', 'future', { startDate: '2026-09-01', usageByPeriod: { '2026-09-01': 300 } }]);
  rows.push(['servicePlans', 'archived', { startDate: '2026-01-31', usageByPeriod: { '2026-08-31': 300 }, archivedAt }]);
  for (let index = 0; index < 7; index++) rows.push(['payments', `z-${index}`, { amount: 0.2, status: 'received', paymentDate: '2026-08-30' }]);
  rows.push(['payments', 'previous-month', { amount: 0.3, status: 'received', paymentDate: '2026-07-31' }]);
  rows.push(['payments', 'next-month', { amount: 0.4, status: 'received', paymentDate: '2026-09-01' }]);
  rows.push(['payments', 'pending', { amount: 500, status: 'pending', paymentDate: '2026-08-31' }]);
  rows.push(['payments', 'reversed', { amount: 500, status: 'reversed', paymentDate: '2026-08-31' }]);
  for (let index = 0; index < rows.length; index += 400) {
    const batch = db.batch();
    for (const [collection, id, data] of rows.slice(index, index + 400)) batch.set(db.collection(collection).doc(id), data);
    await batch.commit();
  }
});
afterAll(async () => { await db?.terminate(); await app?.delete(); });

describe('dashboard queues against Firestore', () => {
  it.each(['tasks', 'followups', 'capacity'])('fills %s pages after more than one batch of ineligible records', async name => {
    const first = await queuePage(db, name, { pageSize: 2 }, today);
    expect(first.rows.map(row => row.id)).toEqual(['z-0', 'z-1']);
    expect(first.hasMore).toBe(true);
    const second = await queuePage(db, name, { pageSize: 2, cursor: first.nextCursor }, today);
    expect(second.rows.map(row => row.id)).toEqual(['z-2', 'z-3']);
    expect(second).toMatchObject({ hasMore: false, nextCursor: null });
    if (name === 'capacity') expect(second.rows[0].remaining).toBe(30);
  });
  it('skips settled invoices before limiting, preserves archived debt and flags legacy partial balances', async () => {
    const first = await queuePage(db, 'overdue', { pageSize: 4 }, today);
    expect(first.rows.map(row => row.id)).toEqual(['z-0', 'z-1', 'z-2', 'z-3']);
    expect(first.rows[0].archivedAt).toBeTruthy();
    const next = await queuePage(db, 'overdue', { pageSize: 4, cursor: first.nextCursor }, today);
    expect(next.rows.map(row => row.id)).toEqual(['legacy-partial']);
    expect(next.hasMore).toBe(false);
  });
  it('finds recent eligible payments past archived rows, with stable equal-date order', async () => {
    const first = await queuePage(db, 'recentPayments', {}, today);
    expect(first.rows.map(row => row.id)).toEqual(['next-month', 'z-6', 'z-5', 'z-4', 'z-3', 'z-2']);
    const second = await queuePage(db, 'recentPayments', { cursor: first.nextCursor }, today);
    expect(second.rows.map(row => row.id)).toEqual(['z-1', 'z-0', 'previous-month']);
    expect(second.hasMore).toBe(false);
  });
  it('validates cursors, queue identity, day expiry and page sizes', async () => {
    const first = await queuePage(db, 'tasks', { pageSize: 1 }, today);
    for (const input of [{ cursor: 'broken' }, { pageSize: 0 }, { pageSize: 101 }, { pageSize: 1.5 }]) await expect(queuePage(db, 'tasks', input, today)).rejects.toMatchObject({ status: 400 });
    await expect(queuePage(db, 'followups', { cursor: first.nextCursor }, today)).rejects.toThrow('cursor');
    await expect(queuePage(db, 'tasks', { cursor: first.nextCursor }, '2026-09-01')).rejects.toThrow('expired');
    await expect(getSummary(db, { queue: 'private' })).rejects.toThrow('Unknown');
  });
  it('aggregates all received money including archives, beyond every list limit, using Chicago month boundaries', async () => {
    const summary = await getSummary(db, {}, new Date('2026-09-01T04:59:59Z'));
    expect(summary.asOfDate).toBe('2026-08-31');
    expect(summary.paymentAggregates).toMatchObject({ complete: true, scope: 'all-records', includesArchived: true, timeZone: 'America/Chicago', month: '2026-08', monthEndExclusive: '2026-09-01', receivedAllTime: 16.1, receivedThisMonth: 15.4, receivedCount: 149 });
    expect(summary.stats).toMatchObject({ activeClients: 4, unreconciled: 3, outstanding: null, monthPaid: 15.4, totalPaid: 16.1 });
    expect(summary.recentPayments).toHaveLength(6);
    const september = await getSummary(db, {}, new Date('2026-09-01T05:00:00Z'));
    expect(september.paymentAggregates).toMatchObject({ month: '2026-09', receivedThisMonth: 0.4 });
  });
  it('handles Chicago year rollover and DST without device-time month drift', async () => {
    const december = await getSummary(db, {}, new Date('2027-01-01T05:59:59Z'));
    expect(december.paymentAggregates).toMatchObject({ month: '2026-12', monthEndExclusive: '2027-01-01' });
    const january = await getSummary(db, {}, new Date('2027-01-01T06:00:00Z'));
    expect(january.paymentAggregates.month).toBe('2027-01');
    const dst = await getSummary(db, {}, new Date('2026-03-08T08:00:00Z'));
    expect(dst.asOfDate).toBe('2026-03-08');
  });
});
