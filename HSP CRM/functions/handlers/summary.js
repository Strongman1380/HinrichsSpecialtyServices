const admin = require('firebase-admin');
const { applyCors } = require('./cors');
const { verifyAdmin } = require('./auth');
const { todayChicago, servicePeriod } = require('./operations-model');
const { rejectOversizedJson } = require('./request-limits');
const { fail } = require('./finance-model');
function campaignSendingEnabled() { return process.env.CAMPAIGN_SENDING_ENABLED === 'true' && Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL && /^\d+$/.test(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID || '')); }

const queueNames = ['tasks', 'followups', 'overdue', 'capacity', 'recentPayments'];
const active = row => !row.archivedAt;
function queueDefinition(db, name, today) {
  switch (name) {
    case 'tasks': return { query: db.collection('tasks').where('status', 'in', ['todo', 'doing']), field: 'dueDate', direction: 'asc', eligible: active };
    case 'followups': return { query: db.collection('contacts').where('followUpDate', '>', '').where('followUpDate', '<=', today), field: 'followUpDate', direction: 'asc', eligible: active };
    // Archived debt remains actionable; paid legacy invoices await reconciliation, not collection.
    case 'overdue': return { query: db.collection('invoices').where('dueDate', '>', '').where('dueDate', '<', today), field: 'dueDate', direction: 'asc', eligible: row => row.accountingVersion === 2 ? Number(row.balanceDue) > 0 : row.status !== 'paid' && row.paymentStatus !== 'paid' && Number(row.balanceDue ?? (Number(row.total || 0) - Number(row.amountPaid || 0))) > 0 };
    case 'recentPayments': return { query: db.collection('payments').where('status', '==', 'received'), field: 'paymentDate', direction: 'desc', eligible: active };
    case 'capacity': return { query: db.collection('servicePlans').where('startDate', '<=', today), field: 'startDate', direction: 'asc', eligible: row => active(row) && row.remaining !== null && row.remaining <= 60, transform: row => {
      try {
        const period = servicePeriod(row.startDate, today);
        const used = Number(row.usageByPeriod?.[period.start] || 0);
        return { ...row, period, remaining: Number.isFinite(used) && used >= 0 ? Math.max(0, 300 - used) : null };
      } catch { return { ...row, remaining: null }; }
    } };
    default: fail('Unknown dashboard queue.');
  }
}

async function queuePage(db, name, { cursor, pageSize = name === 'recentPayments' ? 6 : 20 } = {}, today = todayChicago()) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) fail('Choose a page size from 1 to 100.');
  const spec = queueDefinition(db, name, today);
  let after;
  if (cursor !== undefined && cursor !== null) {
    try {
      if (typeof cursor !== 'string' || cursor.length > 2000) throw new Error();
      const token = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (token.queue !== name || token.today !== today || typeof token.value !== 'string' || token.value.length > 100 || typeof token.id !== 'string' || !token.id || token.id.includes('/') || token.id.length > 1500) throw new Error();
      after = [token.value, token.id];
    } catch { fail('This queue cursor is invalid or expired. Refresh the dashboard.'); }
  }
  const ordered = spec.query.orderBy(spec.field, spec.direction).orderBy(admin.firestore.FieldPath.documentId(), spec.direction);
  const matches = [];
  // Storage batches are not visible pages. Scan past ineligible legacy rows too.
  while (matches.length <= pageSize) {
    const snapshot = await (after ? ordered.startAfter(...after) : ordered).limit(128).get();
    for (const doc of snapshot.docs) {
      let row = { ...doc.data(), id: doc.id };
      if (spec.transform) row = spec.transform(row);
      if (spec.eligible(row)) matches.push(row);
      if (matches.length > pageSize) break;
    }
    if (matches.length > pageSize || snapshot.size < 128) break;
    const last = snapshot.docs[snapshot.size - 1];
    after = [last.get(spec.field), last.id];
  }
  const rows = matches.slice(0, pageSize), last = rows.at(-1), hasMore = matches.length > pageSize;
  return { rows, hasMore, nextCursor: hasMore ? Buffer.from(JSON.stringify({ queue: name, today, value: last[spec.field], id: last.id })).toString('base64url') : null };
}

async function getSummary(db, input = {}, now = new Date()) {
  const today = todayChicago(now), month = today.slice(0, 7);
  if (input.queue) {
    if (!queueNames.includes(input.queue)) fail('Unknown dashboard queue.');
    return { queue: input.queue, page: await queuePage(db, input.queue, input, today), asOfDate: today, timeZone: 'America/Chicago' };
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = `${monthNumber === 12 ? year + 1 : year}-${String(monthNumber === 12 ? 1 : monthNumber + 1).padStart(2, '0')}-01`;
  const sum = admin.firestore.AggregateField.sum;
  const received = db.collection('payments').where('status', '==', 'received');
  const [clients, archivedClients, invoices, accounted, flagged, balances, paid, allPaid, queues] = await Promise.all([
    db.collection('contacts').where('status', '==', 'client').count().get(),
    db.collection('contacts').where('status', '==', 'client').where('archivedAt', '>', new Date(0)).count().get(),
    db.collection('invoices').count().get(),
    db.collection('invoices').where('accountingVersion', '==', 2).count().get(),
    db.collection('invoices').where('accountingVersion', '==', 2).where('reconciliationRequired', '==', true).count().get(),
    db.collection('invoices').aggregate({ amount: sum('balanceDue') }).get(),
    received.where('paymentDate', '>=', `${month}-01`).where('paymentDate', '<', nextMonth).aggregate({ amount: sum('amount') }).get(),
    received.aggregate({ amount: sum('amount'), count: admin.firestore.AggregateField.count() }).get(),
    Promise.all(queueNames.map(name => queuePage(db, name, {}, today))),
  ]);
  const unreconciled = invoices.data().count - accounted.data().count + flagged.data().count;
  const amount = snapshot => Math.round(Number(snapshot.data().amount || 0) * 100) / 100;
  return {
    integrations: { campaignSending: campaignSendingEnabled(), aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY) },
    asOfDate: today, timeZone: 'America/Chicago',
    stats: { activeClients: clients.data().count - archivedClients.data().count, invoiceCount: invoices.data().count, unreconciled, outstanding: unreconciled ? null : amount(balances), monthPaid: amount(paid), totalPaid: amount(allPaid) },
    paymentAggregates: { scope: 'all-records', complete: true, includesArchived: true, status: 'received', timeZone: 'America/Chicago', month, monthStart: `${month}-01`, monthEndExclusive: nextMonth, receivedThisMonth: amount(paid), receivedAllTime: amount(allPaid), receivedCount: allPaid.data().count },
    ...Object.fromEntries(queueNames.map((name, index) => [name, queues[index].rows])),
    queuePages: Object.fromEntries(queueNames.map((name, index) => [name, { hasMore: queues[index].hasMore, nextCursor: queues[index].nextCursor }])),
    queuesLimited: queues.some(page => page.hasMore),
  };
}

module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(cors ? 204 : 403).end();
  if (!cors) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (rejectOversizedJson(req, res, 5000)) return;
  try { return res.json(await getSummary(admin.firestore(), req.body || {})); }
  catch (error) { console.error('[summary]', error.message); return res.status(error.status || 500).json({ error: error.status ? error.message : 'Dashboard could not load. Please retry.' }); }
};
module.exports.campaignSendingEnabled = campaignSendingEnabled;
module.exports.getSummary = getSummary;
module.exports.queuePage = queuePage;
