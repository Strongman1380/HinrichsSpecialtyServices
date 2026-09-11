import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const { subscriptions } = vi.hoisted(() => ({ subscriptions: [] }));
vi.mock('../../HSP CRM/src/firebase', () => ({ db: {} }));
vi.mock('../../HSP CRM/src/api', () => ({ adminRequest: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...path) => ({ path: path.join('/') }),
  documentId: () => '__name__',
  orderBy: (field, direction = 'asc') => ({ kind: 'order', field, direction }),
  limit: value => ({ kind: 'limit', value }),
  where: (...value) => ({ kind: 'where', value }), or: (...value) => ({ kind: 'or', value }),
  query: (root, ...constraints) => ({ ...root, constraints }),
  onSnapshot: (query, next, error) => { const unsubscribe = vi.fn(); subscriptions.push({ query, next, error, unsubscribe }); return unsubscribe; },
}));
import { useRecords, describeActivity, activityTime, localDate, billingPeriod } from '../../HSP CRM/src/records';
const snapshot = rows => ({ docs: rows.map(row => ({ id: row.id, data: () => row })) });
let root, container, latest;
function Probe(props) { latest = useRecords(props.name || 'tasks', props.contactId || 'one', { archived: props.archived ?? 'all' }); return null; }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; subscriptions.length = 0; container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(props = {}) { await act(async () => root.render(React.createElement(Probe, props))); }

describe('record list reliability', () => {
  it('loads legacy clientId payments as well as current contactId payments', async () => {
    await render({ name: 'payments', contactId: 'one' });
    expect(subscriptions[0].query.constraints[0]).toEqual({ kind: 'or', value: [
      { kind: 'where', value: ['contactId', '==', 'one'] },
      { kind: 'where', value: ['clientId', '==', 'one'] },
    ] });
  });
  it('applies activity chronology and an ID tie-breaker before the limit', async () => {
    await render({ name: 'activity' });
    expect(subscriptions[0].query.constraints.slice(-3)).toEqual([{ kind: 'order', field: 'createdAt', direction: 'desc' }, { kind: 'order', field: '__name__', direction: 'desc' }, { kind: 'limit', value: 101 }]);
  });
  it('scans past archived records before filling an eligible page, including legacy rows', async () => {
    await render({ archived: false });
    const archived = Array.from({ length: 101 }, (_, i) => ({ id: `arch-${i}`, archivedAt: { seconds: 1 } }));
    await act(async () => subscriptions[0].next(snapshot(archived)));
    expect(latest.loading).toBe(true);
    expect(subscriptions.at(-1).query.constraints.at(-1).value).toBe(201);
    await act(async () => subscriptions.at(-1).next(snapshot([...archived, { id: 'legacy' }, { id: 'active', archivedAt: null }])));
    expect(latest.records.map(row => row.id)).toEqual(['legacy', 'active']);
    expect(latest.hasMore).toBe(false);
  });
  it('uses lookahead to distinguish exactly 100 records from another page', async () => {
    await render();
    const rows = Array.from({ length: 101 }, (_, index) => ({ id: `row-${index}` }));
    await act(async () => subscriptions[0].next(snapshot(rows.slice(0, 100))));
    expect(latest.hasMore).toBe(false);
    await act(async () => subscriptions[0].next(snapshot(rows)));
    expect(latest.records).toHaveLength(100); expect(latest.hasMore).toBe(true);
    await act(async () => latest.loadMore());
    await act(async () => subscriptions.at(-1).next(snapshot(rows)));
    expect(latest.records).toHaveLength(101); expect(latest.hasMore).toBe(false);
  });
  it('clears old-client rows immediately and ignores late snapshots after a route switch', async () => {
    await render({ contactId: 'one' });
    const old = subscriptions[0];
    await act(async () => old.next(snapshot([{ id: 'old-client-task' }])));
    await render({ contactId: 'two' });
    expect(latest.loading).toBe(true); expect(latest.records).toEqual([]); expect(old.unsubscribe).toHaveBeenCalled();
    await act(async () => old.next(snapshot([{ id: 'stale' }])));
    expect(latest.records).toEqual([]);
    await act(async () => subscriptions.at(-1).next(snapshot([{ id: 'new-client-task' }])));
    expect(latest.records[0].id).toBe('new-client-task');
  });
  it('clears misleading loaded data on failure and retries the same scope', async () => {
    await render();
    await act(async () => subscriptions[0].next(snapshot([{ id: 'loaded' }])));
    await act(async () => subscriptions[0].error(new Error('offline')));
    expect(latest).toMatchObject({ loading: false, records: [], hasMore: false });
    expect(latest.error).toContain('Retry');
    await act(async () => latest.retry());
    expect(latest.loading).toBe(true);
    await act(async () => subscriptions.at(-1).next(snapshot([])));
    expect(latest.error).toBe('');
  });
});

describe('readable activity and Chicago dates', () => {
  it('shows identity, actor, correction reason and changed values without treating patch omissions as deletions', () => {
    const event = describeActivity({ entity: 'invoices', entityId: 'doc-1', actor: 'admin-uid', reason: 'Verified check receipt', action: 'invoice.save', before: { invoiceNumber: 'INV-0012', amountPaid: 20, balanceDue: 130, clientName: 'Client' }, after: { amountPaid: 70, balanceDue: 80, version: 2 } });
    expect(event).toMatchObject({ action: 'Updated', identity: 'INV-0012', actor: 'admin-uid', reason: 'Verified check receipt' });
    expect(event.changes).toEqual([{ field: 'Amount Paid', before: '$20.00', after: '$70.00' }, { field: 'Balance Due', before: '$130.00', after: '$80.00' }]);
  });
  it('distinguishes archive from restore despite the shared archive action', () => {
    const original = { entity: 'tasks', actor: 'admin', entityId: 'task-1', action: 'archive', before: { title: 'Call client', archivedAt: null }, after: { archivedAt: { seconds: 1 } } };
    expect(describeActivity(original)).toMatchObject({ action: 'Archived', identity: 'Call client', changes: [{ field: 'Archive state', before: 'Active', after: 'Archived' }] });
    expect(describeActivity({ ...original, before: { ...original.before, archivedAt: { seconds: 1 } }, after: { archivedAt: null } })).toMatchObject({ action: 'Restored', changes: [{ field: 'Archive state', before: 'Archived', after: 'Active' }] });
  });
  it('uses Chicago for midnight/year boundaries, and clamps anniversaries without drift', () => {
    expect(localDate(new Date('2027-01-01T05:59:59Z'))).toBe('2026-12-31');
    expect(localDate(new Date('2027-01-01T06:00:00Z'))).toBe('2027-01-01');
    expect(billingPeriod('2026-01-31', '2026-02-28')).toEqual({ start: '2026-02-28', end: '2026-03-31' });
    expect(billingPeriod('2026-10-01', '2026-09-11')).toBeNull();
    expect(activityTime({ seconds: new Date('2027-01-01T05:00:00Z').getTime() / 1000 })).toContain('Dec 31, 2026');
    expect(activityTime(null)).toBe('Time unavailable');
  });
});
