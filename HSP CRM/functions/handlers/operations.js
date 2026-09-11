const admin = require('firebase-admin');
const crypto = require('node:crypto');
const { applyCors } = require('./cors');
const { verifyAdmin } = require('./auth');
const { rejectOversizedJson } = require('./request-limits');
const { fail, text, date } = require('./finance-model');
const { timeFields } = require('./operations-model');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const validId = value => { if (!/^[\w-]{1,200}$/.test(value || '')) fail('Invalid record ID.'); return value; };
const conflict = () => { const e = new Error('Record changed. Reopen it and retry.'); e.status = 409; throw e; };
async function execute(db, user, body) {
  const { collection, action, data = {} } = body;
  if (!['tasks', 'servicePlans', 'timeEntries', 'campaigns', 'contacts', 'surveys', 'notes'].includes(collection) || !['save', 'archive'].includes(action)) fail('Unsupported operation.');
  const contactId = text(data.contactId || body.contactId);
  const root = collection === 'notes' ? db.collection('contacts').doc(validId(contactId)).collection('notes') : db.collection(collection);
  const reference = collection === 'servicePlans' ? root.doc(validId(contactId)) : body.id ? root.doc(validId(body.id)) : root.doc();
  const receipt = db.collection('_operationRequests').doc(hash(`${user.uid}:${validId(body.requestId)}`));
  const fingerprint = hash(JSON.stringify({ collection, action, data, contactId, id: body.id || '', version: body.expectedVersion ?? null }));
  return db.runTransaction(async tx => {
    const prior = await tx.get(receipt);
    if (prior.exists) { if (prior.data().fingerprint !== fingerprint) conflict(); return prior.data().result; }
    const snapshot = await tx.get(reference), old = snapshot.data();
    if (body.id && !old) fail('Record not found.');
    if (old && Number(old.version || 0) !== body.expectedVersion) conflict();
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    let patch = {};
    if (action === 'archive') {
      if (!old) fail('Record not found.');
      // Archiving time hides it, but never restores already consumed capacity.
      patch = { archivedAt: data.archived === false ? null : stamp, archivedBy: data.archived === false ? null : user.uid, ...(collection === 'surveys' ? { active: false } : {}) };
    } else {
      if (['tasks', 'timeEntries', 'servicePlans', 'notes'].includes(collection)) {
        const client = await tx.get(db.collection('contacts').doc(validId(contactId)));
        if (!client.exists || client.data().archivedAt) fail('Choose an active client.');
        patch.contactId = contactId;
      }
      if (collection === 'tasks') {
        if (!text(data.title) || !['todo', 'doing', 'done'].includes(data.status)) fail('Enter a task and valid status.');
        patch = { ...patch, title: text(data.title), status: data.status, dueDate: data.dueDate ? date(data.dueDate) : '', notes: text(data.notes, 2000) };
      } else if (collection === 'servicePlans') {
        const startDate = date(data.startDate);
        if (old && old.startDate !== startDate) { const entries = await tx.get(db.collection('timeEntries').where('contactId', '==', contactId).limit(1)); if (!entries.empty) fail('A plan with recorded time cannot change its anniversary.'); }
        patch = { ...patch, startDate, includedMinutes: 300, monthlyPrice: 150 };
      } else if (collection === 'timeEntries') {
        const planRef = db.collection('servicePlans').doc(validId(contactId));
        const plan = await tx.get(planRef);
        if (!plan.exists) fail('Set the client’s service start date first.');
        patch = { ...patch, ...timeFields(data, plan.data()) };
        if (old && old.contactId !== contactId) fail('Time cannot move to another client.');
        const entries = await tx.get(db.collection('timeEntries').where('contactId', '==', contactId));
        const used = entries.docs.filter(d => d.id !== reference.id && d.data().periodStart === patch.periodStart && d.data().billing === 'included').reduce((sum, d) => sum + Number(d.data().minutes || 0), 0);
        if (patch.billing === 'included' && used + patch.minutes > 300) fail('This exceeds the five included hours. Carry the task forward or record approved additional work separately.');
        // Every time write also updates the shared plan, serializing concurrent capacity checks.
        patch.planRevision = Number(plan.data().revision || 0) + 1;
        const usageByPeriod = { ...(plan.data().usageByPeriod || {}), [patch.periodStart]: used + (patch.billing === 'included' ? patch.minutes : 0) };
        if (old && old.periodStart !== patch.periodStart) usageByPeriod[old.periodStart] = entries.docs.filter(d => d.id !== reference.id && d.data().periodStart === old.periodStart && d.data().billing === 'included').reduce((sum, d) => sum + Number(d.data().minutes || 0), 0);
        tx.set(planRef, { revision: patch.planRevision, usageByPeriod }, { merge: true });
      } else if (collection === 'campaigns') {
        if (old && old.status !== 'draft') fail('Only drafts can be edited.');
        if (!text(data.subject)) fail('A subject is required.');
        const recipientIds = Array.isArray(data.recipientIds) ? [...new Set(data.recipientIds.map(validId))].slice(0, 200) : [];
        patch = { subject: text(data.subject), body: text(data.body, 10000), recipientIds, status: 'draft' };
      } else if (collection === 'contacts') {
        if (!text(data.firstName)) fail('First name is required.');
        const email = text(data.email, 180);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
        if (!['lead', 'client', 'prospect', 'inactive'].includes(data.status)) fail('Choose a valid contact status.');
        patch = { firstName: text(data.firstName, 80), lastName: text(data.lastName, 80), email, phone: text(data.phone, 40), company: text(data.company), status: data.status, interest: text(data.interest), notes: text(data.notes, 3000), followUpDate: data.followUpDate ? date(data.followUpDate) : '' };
      } else if (collection === 'notes') {
        if (!text(data.content, 3000)) fail('A note is required.');
        patch = { ...patch, content: text(data.content, 3000), type: ['note', 'call', 'email', 'meeting'].includes(data.type) ? data.type : 'note' };
      } else if (collection === 'surveys') {
        if (old?.archivedAt && data.active === true) fail('Restore the survey before publishing it.');
        if (!text(data.title) || !Array.isArray(data.questions) || !data.questions.length || data.questions.length > 50) fail('A title and 1–50 questions are required.');
        const seen = new Set();
        const questions = data.questions.map(q => { const id = validId(q.id); if (seen.has(id) || !text(q.label) || !['text', 'textarea', 'email', 'number', 'select', 'radio', 'checkbox', 'tel', 'date'].includes(q.type)) fail('Check survey questions and their unique IDs.'); seen.add(id); return { id, label: text(q.label), type: q.type, required: Boolean(q.required), options: Array.isArray(q.options) ? q.options.map(v => text(v)).filter(Boolean).slice(0, 30) : [] }; });
        if (questions.some(q => ['select', 'radio', 'checkbox'].includes(q.type) && !q.options.length)) fail('Choice questions require at least one answer option.');
        patch = { title: text(data.title), description: text(data.description, 2000), active: data.active === true, questions, id: old?.id || reference.id };
      }
    }
    const version = Number(old?.version || 0) + 1;
    tx.set(reference, { ...patch, version, updatedAt: stamp, ...(!old ? { createdAt: stamp, archivedAt: null } : {}) }, { merge: true });
    tx.create(db.collection('activity').doc(), { entity: collection, entityId: reference.id, contactId: contactId || (collection === 'contacts' ? reference.id : old?.contactId || ''), actor: user.uid, action, before: old || null, after: patch, createdAt: stamp });
    const result = { id: reference.id, version };
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
  catch (error) { console.error('[operations]', error.message); return res.status(error.status || 500).json({ error: error.status ? error.message : 'Save failed. Please retry.' }); }
};
module.exports.execute = execute;
