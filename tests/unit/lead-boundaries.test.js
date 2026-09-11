import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
const require = createRequire(import.meta.url);
const { cleanLead } = require('../../HSP CRM/functions/handlers/create-lead');
describe('lead boundaries', () => {
  it('preserves service range, timeline and separate contact/newsletter consent', () => {
    const lead = cleanLead({ firstName: ' Test ', email: 'TEST@example.com', serviceRange: 'website-social', timeline: 'next-month', privacyConsent: true, newsletterConsent: false, metadata: { source: 'contact-form', company: 'Example' } });
    expect(lead).toMatchObject({ firstName: 'Test', email: 'test@example.com', serviceRange: 'website-social', timeline: 'next-month', company: 'Example', consent: { contact: true, newsletter: false } });
  });
  it('does not infer consent from truthy strings', () => {
    expect(cleanLead({ firstName: 'Test', phone: '402-555-0100', privacyConsent: 'true', newsletterConsent: 'false' }).consent).toMatchObject({ contact: false, newsletter: false });
  });
  it('rejects unusable contact details', () => {
    expect(() => cleanLead({ firstName: 'Test', email: 'broken' })).toThrow();
    expect(() => cleanLead({ firstName: 'Test' })).toThrow();
  });
});
