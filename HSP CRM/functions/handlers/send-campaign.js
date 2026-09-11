const admin = require('firebase-admin');
const { applyCors } = require('./cors');
const { verifyAdmin } = require('./auth');
const { rejectOversizedJson } = require('./request-limits');
const { campaignSendingEnabled } = require('./summary');
module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(cors ? 204 : 403).end();
  if (!cors) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (rejectOversizedJson(req, res, 4000)) return;
  if (!campaignSendingEnabled()) return res.status(503).json({ error: 'Campaign sending is disabled. Save a draft instead.' });
  if (!/^[\w-]{1,200}$/.test(req.body?.campaignId || '')) return res.status(400).json({ error: 'Choose a saved campaign.' });
  const db = admin.firestore(), ref = db.collection('campaigns').doc(req.body.campaignId);
  let prepared;
  try {
    prepared = await db.runTransaction(async tx => {
      const snap = await tx.get(ref), campaign = snap.data();
      if (!campaign || campaign.archivedAt) throw new Error('Campaign is not available.');
      if (campaign.status !== 'draft') return { existing: campaign.status };
      if (Number(campaign.version || 0) !== req.body.expectedVersion) throw new Error('Campaign changed. Reload before sending.');
      if (!campaign.body?.trim() || !campaign.recipientIds?.length) throw new Error('A message and subscribers are required.');
      const recipients = [];
      for (const id of campaign.recipientIds) {
        const person = (await tx.get(db.collection('contacts').doc(id))).data();
        if (!person || person.archivedAt || person.newsletter?.status !== 'subscribed' || !person.email) throw new Error('A recipient is no longer subscribed. Edit the draft first.');
        if (!recipients.some(p => p.email === person.email)) recipients.push({ email: person.email });
      }
      tx.update(ref, { status: 'sending', version: Number(campaign.version || 0) + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { campaign, recipients };
    });
  } catch (e) { return res.status(409).json({ error: e.message }); }
  if (prepared.existing) return res.json({ status: prepared.existing });
  let status = 'unknown';
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: prepared.recipients.map(to => ({ to: [to] })), from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'HSST' }, subject: prepared.campaign.subject, content: [{ type: 'text/plain', value: prepared.campaign.body }], asm: { group_id: Number(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID) } }), signal: AbortSignal.timeout(20000) });
    status = response.ok ? 'accepted' : 'failed';
  } catch { /* Outcome may be unknown. Never automatically resend. */ }
  const batch = db.batch();
  batch.update(ref, { status, updatedAt: admin.firestore.FieldValue.serverTimestamp(), recipientCount: prepared.recipients.length });
  batch.create(db.collection('activity').doc(), { entity: 'campaigns', entityId: ref.id, actor: auth.user.uid, action: `send.${status}`, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  await batch.commit();
  return res.json({ status });
};
