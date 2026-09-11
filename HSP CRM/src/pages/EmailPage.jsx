import { useEffect, useState } from 'react';
import { useRecords, saveRecord, archiveRecord } from '../records';
import { adminRequest } from '../api';
import Dialog from '../components/Dialog';
export default function EmailPage() {
  const campaigns = useRecords('campaigns'), contacts = useRecords('contacts');
  const [editing, setEditing] = useState(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [archived, setArchived] = useState(false), [enabled, setEnabled] = useState(false);
  useEffect(() => { adminRequest('/api/summary', {}).then(data => setEnabled(data.integrations?.campaignSending === true)).catch(() => setNotice('Integration status could not load. Sending is disabled.')); }, []);
  async function run(fn) { setBusy(true); setNotice(''); try { await fn(); } catch (e) { setNotice(e.message); } finally { setBusy(false); } }
  const recipients = contacts.records.filter(c => !c.archivedAt && c.email && c.newsletter?.status === 'subscribed');
  return <div className="client-workspace space-y-6"><header><h1 className="text-2xl font-bold">Email campaigns</h1><p>Saved drafts and real sending history. Opens and clicks are not tracked here.</p><button onClick={() => setEditing({ subject: '', body: '', recipientIds: [] })}>New draft</button></header>
    <p>{enabled ? 'Manual campaign sending is configured. Every send requires confirmation.' : 'Sending is disabled until a sender, unsubscribe group, and delivery service are explicitly configured. Drafts still work.'}</p>
    {(notice || campaigns.error || contacts.error) && <p role="alert">{notice || campaigns.error || contacts.error} <button onClick={() => { campaigns.retry(); contacts.retry(); }}>Reload records</button></p>}
    <label><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Show archived campaigns</label>
    {campaigns.loading ? <p role="status">Loading campaigns…</p> : campaigns.records.filter(c => Boolean(c.archivedAt) === archived).map(c => <article className="workspace-section" key={c.id}><h2>{c.subject}</h2><p>{c.status} · {c.recipientIds?.length || 0} selected subscribers</p><p className="whitespace-pre-wrap">{c.body}</p><div className="flex flex-wrap gap-3">
      {c.status === 'draft' && <button onClick={() => setEditing(c)}>Edit draft</button>}
      <button disabled={busy} onClick={() => run(() => archiveRecord('campaigns', c))}>{c.archivedAt ? 'Restore' : 'Archive'}</button>
      <button disabled={busy || !enabled || c.status !== 'draft' || Boolean(c.archivedAt)} onClick={() => { if (confirm(`Send “${c.subject}” to its selected opted-in subscribers?`)) run(async () => { const result = await adminRequest('/api/send-campaign', { campaignId: c.id, expectedVersion: c.version || 0 }); setNotice(`Delivery status: ${result.status}. Accepted means queued by the provider, not confirmed delivered.`); }); }}>Send campaign</button>
    </div></article>)}
    {!campaigns.loading && !campaigns.error && !campaigns.records.length && <p>No campaigns yet. Start by saving a draft.</p>}
    {campaigns.hasMore && <button onClick={campaigns.loadMore}>Load more campaigns</button>}
    {editing && <Dialog title={editing.id ? 'Edit campaign draft' : 'New campaign draft'} onClose={() => !busy && setEditing(null)}>{notice && <p role="alert">{notice}</p>}<form className="workspace-form" onSubmit={e => { e.preventDefault(); run(async () => { await saveRecord('campaigns', editing, editing.id ? editing : null); setEditing(null); setNotice('Draft saved. Nothing was sent.'); }); }}><label>Subject<input required value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })} /></label><label>Message<textarea required rows={8} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} /></label><fieldset><legend>Opted-in subscribers</legend>{recipients.map(c => <label className="flex gap-2" key={c.id}><input type="checkbox" checked={editing.recipientIds?.includes(c.id)} onChange={e => setEditing({ ...editing, recipientIds: e.target.checked ? [...editing.recipientIds, c.id] : editing.recipientIds.filter(id => id !== c.id) })} />{c.firstName} {c.lastName} · {c.email}</label>)}{!recipients.length && <p>No opted-in subscribers loaded.</p>}{contacts.hasMore && <button type="button" onClick={contacts.loadMore}>Load more clients</button>}</fieldset><button disabled={busy}>Save draft</button></form></Dialog>}
  </div>;
}
