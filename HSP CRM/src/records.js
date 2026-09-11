import { useEffect, useState } from 'react';
import { collection, documentId, limit, onSnapshot, orderBy, query, where, or } from 'firebase/firestore';
import { db } from './firebase';
import { adminRequest } from './api';
export const saveRecord = (collection, data, record) => adminRequest('/api/operations', { collection, action: 'save', data, ...(record?.id ? { id: record.id, expectedVersion: record.version || 0 } : {}) });
export const archiveRecord = (collection, record, contactId) => adminRequest('/api/operations', { collection, action: 'archive', id: record.id, contactId, expectedVersion: record.version || 0, data: { archived: !record.archivedAt } });
export function useRecords(name, contactId, { archived = 'all', enabled = true } = {}) {
  const key = JSON.stringify([name, contactId || '', archived, enabled]);
  const [window, setWindow] = useState({ key, size: 100, scan: 100 });
  const [result, setResult] = useState({ key, records: [], loading: true, error: '', hasMore: false });
  const [retry, setRetry] = useState(0);
  const { size, scan } = window.key === key ? window : { size: 100, scan: 100 };
  useEffect(() => {
    let active = true;
    if (!enabled) { setResult({ key, records: [], loading: false, error: '', hasMore: false }); return; }
    setResult(previous => ({ key, records: previous.key === key ? previous.records : [], loading: true, error: '', hasMore: false }));
    if (name === 'notes' && !contactId) { setResult({ key, records: [], loading: false, error: 'Choose a client to load notes.', hasMore: false }); return; }
    const root = name === 'notes' ? collection(db, 'contacts', contactId, 'notes') : collection(db, name);
    const constraints = contactId && name !== 'notes' ? [['invoices', 'payments'].includes(name) ? or(where('contactId', '==', contactId), where('clientId', '==', contactId)) : where('contactId', '==', contactId)] : [];
    // Activity is chronological before limiting; document IDs break timestamp ties.
    // Other collections use IDs so legacy rows without timestamps remain reachable.
    const ordering = name === 'activity' ? [orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc')] : [orderBy(documentId())];
    const unsubscribe = onSnapshot(query(root, ...constraints, ...ordering, limit(scan + 1)), snapshot => {
      if (!active) return;
      const eligible = snapshot.docs.map(d => ({ ...d.data(), publicId: d.data().id, id: d.id })).filter(row => archived === 'all' || Boolean(row.archivedAt) === archived);
      if (eligible.length <= size && snapshot.docs.length > scan) {
        setWindow({ key, size, scan: scan + 100 });
        return;
      }
      setResult({ key, records: eligible.slice(0, size), loading: false, error: '', hasMore: eligible.length > size });
    }, () => { if (active) setResult({ key, records: [], loading: false, error: `${name} could not load. Retry when the connection is available.`, hasMore: false }); });
    return () => { active = false; unsubscribe(); };
  }, [name, contactId, archived, enabled, key, size, scan, retry]);
  return { ...(result.key === key ? result : { records: [], loading: true, error: '', hasMore: false }), loadMore: () => setWindow({ key, size: size + 100, scan: Math.max(scan, size + 100) }), retry: () => setRetry(n => n + 1) };
}
export function localDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function useChicagoDate() {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const update = () => setToday(localDate());
    const interval = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { clearInterval(interval); window.removeEventListener('focus', update); };
  }, []);
  return today;
}
export function billingPeriod(startDate, onDate = localDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || onDate < startDate) return null;
  const anchor = Number(startDate.slice(8));
  const anniversary = (y, m) => `${y}-${String(m).padStart(2, '0')}-${String(Math.min(anchor, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, '0')}`;
  let [y, m] = onDate.split('-').map(Number);
  if (onDate < anniversary(y, m)) { m--; if (!m) { m = 12; y--; } }
  return { start: anniversary(y, m), end: anniversary(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1) };
}

export function activityTime(value) {
  const date = value?.toDate?.() || (value?.seconds != null ? new Date(value.seconds * 1000) : value?._seconds != null ? new Date(value._seconds * 1000) : value ? new Date(value) : null);
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Time unavailable';
}
const fieldLabel = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
function activityValue(key, value) {
  if (value === undefined || value === null || value === '') return 'Not set';
  if (key === 'archivedAt') return value ? 'Archived' : 'Active';
  if (value?.seconds != null || value?.toDate) return activityTime(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (['amount', 'total', 'amountPaid', 'balanceDue', 'creditAmount', 'rate'].includes(key)) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? Object.entries(item).map(([field, v]) => `${fieldLabel(field)}: ${v}`).join(', ') : String(item)).join('; ');
  if (typeof value === 'object') return Object.entries(value).map(([field, v]) => `${fieldLabel(field)}: ${String(v)}`).join('; ');
  return String(value);
}
export function describeActivity(event) {
  const before = event.before || {}, patch = event.after || {}, after = { ...before, ...patch };
  const archived = /archive|restore/.test(event.action || '');
  const action = archived ? (patch.archivedAt === null || event.action?.includes('restore') ? 'Restored' : 'Archived') : event.action?.includes('reconcil') ? 'Reconciled' : event.action?.includes('reverse') ? 'Reversed' : event.before ? 'Updated' : 'Created';
  const entity = { contacts: 'Client', tasks: 'Task', timeEntries: 'Time entry', notes: 'Note', invoices: 'Invoice', payments: 'Payment', servicePlans: 'Service plan' }[event.entity] || fieldLabel(event.entity || 'Record');
  const identity = event.recordLabel || after.invoiceNumber || after.title || after.scope || after.content || after.contactName || [after.firstName, after.lastName].filter(Boolean).join(' ') || event.entityId || 'Unknown record';
  const actor = typeof event.actor === 'object' && event.actor ? event.actor.displayName || event.actor.email || event.actor.uid : event.actor;
  const ignored = new Set(['createdAt', 'updatedAt', 'archivedAt', 'archivedBy', 'version', 'planRevision', 'accountingVersion', 'totalCents', 'receivedCents', 'adjustmentCents', 'lastCorrectionReason']);
  const changes = Array.isArray(event.changes) ? event.changes.map(change => ({ field: change.label || fieldLabel(change.field), before: String(change.before ?? 'Not set'), after: String(change.after ?? 'Not set') })) : Object.keys(patch).filter(key => !ignored.has(key) && JSON.stringify(before[key] ?? null) !== JSON.stringify(patch[key] ?? null)).map(key => ({ field: fieldLabel(key), before: activityValue(key, before[key]), after: activityValue(key, patch[key]) }));
  if (archived && !Array.isArray(event.changes)) changes.unshift({ field: 'Archive state', before: before.archivedAt ? 'Archived' : 'Active', after: patch.archivedAt === null ? 'Active' : 'Archived' });
  return { action, entity, identity, actor: event.actorName || event.actorEmail || actor || 'Unknown actor', actorId: typeof event.actor === 'string' ? event.actor : event.actor?.uid, reason: event.reason || event.correctionReason || patch.lastCorrectionReason || '', changes };
}
