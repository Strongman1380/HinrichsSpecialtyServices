import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminRequest } from '../api';
import { money } from '../payment-utils';
import { useChicagoDate } from '../records';
export default function DashboardPage() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [queueState, setQueueState] = useState({});
  const today = useChicagoDate();
  useEffect(() => { let active = true; setError(''); setData(null); setQueueState({}); adminRequest('/api/summary', {}).then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [retry, today]);
  async function loadQueue(queue) {
    const cursor = data.queuePages[queue].nextCursor, asOfDate = data.asOfDate;
    setQueueState(current => ({ ...current, [queue]: { loading: true } }));
    try {
      const result = await adminRequest('/api/summary', { queue, cursor, action: 'summary.queue', collection: queue, id: cursor });
      setData(current => {
        if (!current || current.asOfDate !== asOfDate || current.queuePages[queue].nextCursor !== cursor) return current;
        const rows = new Map(current[queue].map(row => [row.id, row]));
        result.page.rows.forEach(row => rows.set(row.id, row));
        return { ...current, [queue]: [...rows.values()], queuePages: { ...current.queuePages, [queue]: { hasMore: result.page.hasMore, nextCursor: result.page.nextCursor } } };
      });
      setQueueState(current => ({ ...current, [queue]: {} }));
    } catch (e) { setQueueState(current => ({ ...current, [queue]: { error: e.message } })); }
  }
  if (error) return <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry dashboard</button></p>;
  if (!data) return <p role="status">Loading dashboard…</p>;
  const stats = data.stats;
  return <div className="client-workspace min-w-0 break-words space-y-6"><header><h1 className="text-2xl font-bold">Today’s workspace</h1><p>Client work, follow-ups, and money received. Archived records never erase outstanding debt.</p><button onClick={() => setRetry(n => n + 1)}>Refresh dashboard</button></header>
    {stats.unreconciled > 0 && <p role="alert" className="workspace-notice">{stats.unreconciled} legacy invoices require verified balance reconciliation. The outstanding total is withheld until reconciliation is complete.</p>}
    <div className="grid gap-4 sm:grid-cols-3">{[['Active clients', stats.activeClients, '/crm'], ['Outstanding', stats.unreconciled ? 'Reconciliation required' : money(stats.outstanding), '/invoices'], ['Received this month', money(stats.monthPaid), '/payments']].map(([name,value,to]) => <Link className="workspace-section" to={to} key={name}><h2>{name}</h2><p className="text-2xl font-bold">{value}</p></Link>)}</div>
    <p className="text-sm">Received totals include all received payments, including archived records, independent of list filters or pages. Month and due dates use America/Chicago{data.asOfDate ? ` · as of ${data.asOfDate}` : ''}.</p>
    {[['followups', 'Follow-ups due', c => `${c.firstName || ''} ${c.lastName || ''} · ${c.followUpDate}`, c => `/clients/${c.id}`], ['tasks', 'Upcoming work', t => `${t.title} · ${t.dueDate || 'No due date'}`, t => t.contactId ? `/clients/${t.contactId}` : '/crm'], ['capacity', 'Near included-hour limit', p => `${p.contactName || p.contactId} · ${p.remaining} minutes remaining`, p => `/clients/${p.contactId}`], ['overdue', 'Overdue invoices', i => `${i.invoiceNumber || i.id} · ${i.accountingVersion === 2 ? `${money(i.balanceDue)} due` : 'Balance needs reconciliation'}${i.archivedAt ? ' · archived' : ''}`, () => '/invoices'], ['recentPayments', 'Recent payments', p => `${p.contactName || p.contactId || 'Unlinked payment'} · ${money(p.amount)} · ${p.paymentDate}`, () => '/payments']].map(([queue,title,label,url]) => <section key={queue} className="workspace-section" aria-label={title}><h2>{title}</h2>{data[queue]?.length ? data[queue].map(row => <article key={row.id}><Link className="min-w-0 [overflow-wrap:anywhere]" to={url(row)}>{label(row)}</Link></article>) : <p>Nothing to show in this queue.</p>}{queueState[queue]?.error && <p role="alert">{queueState[queue].error}</p>}{data.queuePages?.[queue]?.hasMore && <button disabled={queueState[queue]?.loading} onClick={() => loadQueue(queue)}>{queueState[queue]?.loading ? 'Loading…' : `Load more ${title.toLowerCase()}`}</button>}</section>)}
  </div>;
}
