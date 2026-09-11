import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { saveRecord, archiveRecord, useRecords, localDate, billingPeriod, useChicagoDate, describeActivity, activityTime } from '../records';
import { money } from '../payment-utils';

function RecordsSection({ title, state, children }) {
  return <section className="workspace-section min-w-0" aria-label={title}><h2>{title}</h2>{state.loading ? <p role="status">Loading…</p> : state.error ? <p role="alert">{state.error} <button onClick={state.retry}>Retry</button></p> : children}{!state.loading && !state.error && state.hasMore && <button onClick={state.loadMore}>Load more {title.toLowerCase()}</button>}</section>;
}
export default function ClientWorkspace() {
  const { contactId } = useParams();
  return <Workspace key={contactId} contactId={contactId} />;
}
function Workspace({ contactId }) {
  const [client, setClient] = useState(null), [clientError, setClientError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [plan, setPlan] = useState(null), [startDate, setStartDate] = useState(''), [followUp, setFollowUp] = useState('');
  const [archives, setArchives] = useState(false), [planLoading, setPlanLoading] = useState(true), [planError, setPlanError] = useState(''), [retry, setRetry] = useState(0);
  const today = useChicagoDate();
  const tasks = useRecords('tasks', contactId, { archived: archives }), times = useRecords('timeEntries', contactId, { archived: archives }), notes = useRecords('notes', contactId, { archived: archives }), invoices = useRecords('invoices', contactId), payments = useRecords('payments', contactId), activity = useRecords('activity', contactId);
  // Only legacy plans without server usage totals need a separate complete time scan.
  const capacityTime = useRecords('timeEntries', contactId, { enabled: !planLoading && !planError && Boolean(plan) && !plan.usageByPeriod });
  const [task, setTask] = useState({ title: '', status: 'todo', dueDate: '' });
  const [time, setTime] = useState({ workDate: localDate(), minutes: 30, billing: 'included', scope: '', rate: 45, approval: '', approvedOn: '' });
  const [note, setNote] = useState({ content: '', type: 'note' });
  useEffect(() => {
    let active = true;
    setClientError(''); setPlanError(''); setPlanLoading(true);
    const a = onSnapshot(doc(db, 'contacts', contactId), snapshot => { if (!active) return; setClientError(snapshot.exists() ? '' : 'Client not found.'); setClient(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null); setFollowUp(snapshot.data()?.followUpDate || ''); }, () => { if (active) setClientError('Client could not load.'); });
    const b = onSnapshot(doc(db, 'servicePlans', contactId), snapshot => { if (!active) return; setPlanError(''); setPlan(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null); setStartDate(snapshot.data()?.startDate || ''); setPlanLoading(false); }, () => { if (active) { setPlanError('Service plan could not load.'); setPlanLoading(false); } });
    return () => { active = false; a(); b(); };
  }, [contactId, retry]);
  async function perform(fn) { setBusy(true); setNotice(''); try { await fn(); setNotice('Saved.'); } catch (e) { setNotice(e.message); } finally { setBusy(false); } }
  const period = plan?.startDate ? billingPeriod(plan.startDate, today) : null;
  const recordedUsage = plan?.usageByPeriod ? Number(plan.usageByPeriod[period?.start] || 0) : null;
  const used = recordedUsage ?? capacityTime.records.filter(t => t.periodStart === period?.start && t.billing === 'included').reduce((sum, t) => sum + Number(t.minutes), 0);
  const capacityReady = !planLoading && !planError && (recordedUsage !== null || (!capacityTime.loading && !capacityTime.error && !capacityTime.hasMore)) && Number.isFinite(used) && used >= 0;
  const visible = records => records.filter(r => Boolean(r.archivedAt) === archives);
  if (clientError) return <p role="alert">{clientError} <button onClick={() => setRetry(n => n + 1)}>Retry client</button></p>;
  if (!client) return <p role="status">Loading client…</p>;
  return <div className="client-workspace min-w-0 [overflow-wrap:anywhere] space-y-6">
    <header><Link to="/crm">← Clients</Link><h1 className="text-2xl font-bold">{client.firstName} {client.lastName}{client.archivedAt ? ' · archived' : ''}</h1><p>{client.company} · {client.email} · {client.phone}</p><p>{client.notes}</p></header>
    {notice && <p role="status" className="workspace-notice">{notice}</p>}
    <section className="workspace-section"><h2>Monthly service capacity</h2><p>$150/month · 300 included minutes · billing anniversary · America/Chicago</p>
      {planLoading && <p role="status">Loading service capacity…</p>}
      {planError && <p role="alert">{planError} <button onClick={() => setRetry(n => n + 1)}>Retry service plan</button></p>}
      <form onSubmit={e => { e.preventDefault(); perform(() => saveRecord('servicePlans', { contactId, startDate }, plan)); }}><label>Original service start date<input type="date" required disabled={planLoading || Boolean(planError)} value={startDate} onChange={e => setStartDate(e.target.value)} /></label><button disabled={busy || planLoading || Boolean(planError) || Boolean(client.archivedAt)}>Save anniversary</button></form>
      {!planLoading && !planError && plan?.startDate > today && <p>Service starts {plan.startDate}. No current billing period.</p>}
      {!planLoading && !planError && plan?.archivedAt && <p>Service plan is archived.</p>}
      {period && <p>{period.start} – {period.end} (end exclusive): {capacityReady ? `${Math.max(0, 300 - used)} minutes remaining` : capacityTime.loading || planLoading ? 'Loading service capacity…' : 'Capacity unavailable. Retry or load all time records.'}. Unused minutes expire; unfinished tasks remain.</p>}
      {period && recordedUsage === null && capacityTime.error && <p role="alert">{capacityTime.error} <button onClick={capacityTime.retry}>Retry capacity</button></p>}
      {period && recordedUsage === null && capacityTime.hasMore && <button disabled={capacityTime.loading} onClick={capacityTime.loadMore}>Load more time for capacity</button>}
      <form onSubmit={e => { e.preventDefault(); perform(() => saveRecord('contacts', { ...client, followUpDate: followUp }, client)); }}><label>Next follow-up<input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} /></label><button disabled={busy}>Save follow-up</button></form>
    </section>
    <label className="flex gap-2"><input type="checkbox" checked={archives} onChange={e => setArchives(e.target.checked)} />Show archived records</label>
    <RecordsSection title="Tasks" state={tasks}>
      <form onSubmit={e => { e.preventDefault(); perform(async () => { await saveRecord('tasks', { ...task, contactId }, task.id ? task : null); setTask({ title: '', status: 'todo', dueDate: '' }); }); }}>
        <label>Task<input required value={task.title} onChange={e => setTask({ ...task, title: e.target.value })} /></label><label>Due date<input type="date" value={task.dueDate} onChange={e => setTask({ ...task, dueDate: e.target.value })} /></label><label>Status<select value={task.status} onChange={e => setTask({ ...task, status: e.target.value })}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select></label><button disabled={busy}>{task.id ? 'Update task' : 'Add task'}</button>
      </form>
      {visible(tasks.records).map(t => <article key={t.id}><div><strong>{t.title}</strong><p>{t.status} · {t.dueDate || 'No due date'}</p></div><button onClick={() => setTask(t)}>Edit</button><button disabled={busy} onClick={() => perform(() => archiveRecord('tasks', t))}>{t.archivedAt ? 'Restore' : 'Archive'}</button></article>)}
    </RecordsSection>
    <RecordsSection title="Time entries" state={times}>
      <form onSubmit={e => { e.preventDefault(); perform(async () => { await saveRecord('timeEntries', { ...time, contactId }, time.id ? time : null); setTime({ workDate: localDate(), minutes: 30, billing: 'included', scope: '', rate: 45, approval: '', approvedOn: '' }); }); }}>
        <label>Work date<input type="date" required value={time.workDate} onChange={e => setTime({ ...time, workDate: e.target.value })} /></label><label>Minutes<input type="number" min="1" max="1440" step="1" required value={time.minutes} onChange={e => setTime({ ...time, minutes: Number(e.target.value) })} /></label><label>Work performed<input required value={time.scope} onChange={e => setTime({ ...time, scope: e.target.value })} /></label><label>Allocation<select value={time.billing} onChange={e => setTime({ ...time, billing: e.target.value })}><option value="included">Included hours</option><option value="additional">Approved additional work</option></select></label>
        {time.billing === 'additional' && <><label>Approved hourly rate<input type="number" min="30" max="65" step="0.01" required value={time.rate} onChange={e => setTime({ ...time, rate: Number(e.target.value) })} /></label><label>Advance approval reference<input required value={time.approval} onChange={e => setTime({ ...time, approval: e.target.value })} /></label><label>Approval date<input type="date" required max={time.workDate} value={time.approvedOn} onChange={e => setTime({ ...time, approvedOn: e.target.value })} /></label></>}
        <button disabled={busy || planLoading || Boolean(planError) || !plan || Boolean(client.archivedAt)}>{time.id ? 'Update time' : 'Log time'}</button>
      </form><p>Logging time does not create a charge or send an invoice. Archived time still consumes its recorded allocation.</p>
      {visible(times.records).map(t => <article key={t.id}><div><strong>{t.scope}</strong><p>{t.workDate} · {t.minutes} min · {t.billing}</p></div><button onClick={() => setTime(t)}>Edit</button><button disabled={busy} onClick={() => perform(() => archiveRecord('timeEntries', t))}>{t.archivedAt ? 'Restore' : 'Archive'}</button></article>)}
    </RecordsSection>
    <RecordsSection title="Notes" state={notes}><form onSubmit={e => { e.preventDefault(); perform(async () => { await saveRecord('notes', { ...note, contactId }, note.id ? note : null); setNote({ content: '', type: 'note' }); }); }}><label>Note<textarea required value={note.content} onChange={e => setNote({ ...note, content: e.target.value })} /></label><button disabled={busy}>{note.id ? 'Update note' : 'Add note'}</button></form>{visible(notes.records).map(n => <article key={n.id}><p>{n.content}</p><button onClick={() => setNote(n)}>Edit</button><button disabled={busy} onClick={() => perform(() => archiveRecord('notes', n, contactId))}>{n.archivedAt ? 'Restore' : 'Archive'}</button></article>)}</RecordsSection>
    <RecordsSection title="Invoices" state={invoices}><Link to="/invoices">Manage invoices</Link>{invoices.records.map(i => <article key={i.id}><strong>{i.invoiceNumber}{i.archivedAt ? ' · archived' : ''}</strong><span>{money(i.balanceDue ?? i.total)} due · {money(i.creditAmount)} credit</span></article>)}</RecordsSection>
    <RecordsSection title="Payments" state={payments}><Link to="/payments">Manage payments</Link>{payments.records.map(p => <article key={p.id}><span>{p.paymentDate} · {p.method} · {p.status}{p.archivedAt ? ' · archived' : ''}</span><strong>{money(p.amount)}</strong></article>)}</RecordsSection>
    <RecordsSection title="Activity" state={activity}>{!activity.records.length && <p>No activity recorded.</p>}{activity.records.map(event => {
      const item = describeActivity(event);
      return <article key={event.id}><div className="w-full min-w-0"><strong>{item.action} {item.entity.toLowerCase()}: {item.identity}</strong><p>Record: {event.entityId || 'Unknown'} · By {item.actor}{item.actorId && item.actorId !== item.actor ? ` (${item.actorId})` : ''}</p><p><time>{activityTime(event.createdAt)}</time> · America/Chicago</p>{item.reason && <p>Correction reason: {item.reason}</p>}{item.changes.length > 0 && <details><summary className="min-h-11 cursor-pointer py-2">Before and after ({item.changes.length} changed fields)</summary><dl className="space-y-3">{item.changes.map(change => <div key={change.field}><dt className="font-semibold">{change.field}</dt><dd>Before: {change.before}</dd><dd>After: {change.after}</dd></div>)}</dl></details>}</div></article>;
    })}</RecordsSection>
  </div>;
}
