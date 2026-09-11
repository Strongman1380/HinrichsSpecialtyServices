const admin = require('firebase-admin');
const crypto = require('node:crypto');
const { applyCors } = require('./cors');
const { enforceRateLimit } = require('./rate-limit');
const { rejectOversizedJson } = require('./request-limits');
const { text } = require('./finance-model');
function cleanLead(body = {}) {
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const email = text(body.email, 180).toLowerCase(), phone = text(body.phone, 40), firstName = text(body.firstName, 80);
  if (!firstName || (!email && !phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter your name and a valid email or phone number.');
  return { firstName, lastName: text(body.lastName, 80), email, phone, company: text(metadata.company, 160), interest: text(body.interest, 160), notes: text(body.message, 3000), serviceRange: text(body.serviceRange, 160), timeline: text(body.timeline, 160), metadata: { source: text(metadata.source, 80) || 'website', page: text(metadata.page, 300) }, consent: { contact: body.privacyConsent === true, newsletter: body.newsletterConsent === true, policyVersion: '2026-09' } };
}
module.exports = async (req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(cors ? 204 : 403).end();
  if (!cors) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectOversizedJson(req, res, 16000)) return;
  if (text(req.body?.website)) return res.json({ success: true });
  let lead;
  try { lead = cleanLead(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
  const requestId = req.body?.requestId;
  if (!/^[\w-]{16,100}$/.test(requestId || '')) return res.status(400).json({ error: 'Refresh the page before submitting.' });
  if (lead.metadata.source === 'newsletter-form' && !lead.consent.newsletter) return res.status(400).json({ error: 'Newsletter consent is required.' });
  if (['contact-form', 'chatbot-follow-up', 'service-request-form'].includes(lead.metadata.source) && !lead.consent.contact) return res.status(400).json({ error: 'Please confirm permission to contact you.' });
  const allowed = await enforceRateLimit(req, 'lead', 8, 60 * 60 * 1000);
  if (!allowed) return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  const db = admin.firestore();
  const digest = crypto.createHash('sha256').update(JSON.stringify(lead)).digest('hex');
  const receipt = db.collection('_leadRequests').doc(requestId);
  try {
    const result = await db.runTransaction(async tx => {
      const prior = await tx.get(receipt);
      if (prior.exists) {
        if (prior.data().digest !== digest) { const error = new Error('Request changed. Refresh and submit again.'); error.status = 409; throw error; }
        return { success: true, id: prior.data().id };
      }
      const contact = db.collection('contacts').doc();
      const stamp = admin.firestore.FieldValue.serverTimestamp();
      tx.create(contact, { ...lead, consent: { ...lead.consent, contactAt: lead.consent.contact ? stamp : null, newsletterAt: lead.consent.newsletter ? stamp : null }, status: 'lead', createdAt: stamp, updatedAt: stamp, archivedAt: null, version: 0, newsletter: { status: lead.consent.newsletter ? 'subscribed' : 'not-subscribed', consentAt: lead.consent.newsletter ? stamp : null } });
      tx.create(db.collection('responses').doc(), { surveyTitle: 'Website Lead Inquiry', response: lead, submittedAt: stamp, contactId: contact.id });
      tx.create(receipt, { digest, id: contact.id, createdAt: stamp });
      return { success: true, id: contact.id };
    });
    return res.json(result);
  } catch (e) { console.error('[lead]', e.message); return res.status(e.status || 500).json({ error: e.status ? e.message : 'Your message could not be saved. Please retry.' }); }
};
module.exports.cleanLead = cleanLead;
