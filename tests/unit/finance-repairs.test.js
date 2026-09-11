import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { financialClientOptions, financialRecord, paymentInvoiceOptions } from '../../HSP CRM/src/finance-options';
const require = createRequire(import.meta.url);
const { cents, paymentState } = require('../../HSP CRM/functions/handlers/finance-model');
const { normalizeInvoiceNumber, reservationId, planInvoiceNumberBackfill } = require('../../HSP CRM/functions/handlers/finance-numbers');
const { financeActivity } = require('../../HSP CRM/functions/handlers/finance-activity');

describe('finance repair boundaries', () => {
  it('requires explicit numeric money and integer ledger cents', () => {
    for (const value of ['', '  ', null, undefined, true, [], {}, NaN, Infinity]) expect(() => cents(value)).toThrow();
    expect(cents('0')).toBe(0);
    for (const adjustment of [NaN, Infinity, 0.5]) expect(() => paymentState(15000, 10000, adjustment)).toThrow();
  });
  it('uses one canonical key for legacy whitespace, case, and compatibility forms', () => {
    expect(normalizeInvoiceNumber('  ｉｎｖ-００４２  ')).toBe('INV-0042');
    expect(normalizeInvoiceNumber(' Custom   number ')).toBe('CUSTOM NUMBER');
    expect(reservationId(' inv-0042 ')).toBe(reservationId('INV-0042'));
    expect(() => normalizeInvoiceNumber('a'.repeat(81))).toThrow();
  });
  it('reports collisions without choosing an owner and deterministically proposes valid reservations', () => {
    const invoices = [{ id: 'b', invoiceNumber: ' inv-0042 ' }, { id: 'a', invoiceNumber: 'INV-0042' }, { id: 'c', invoiceNumber: 'custom', version: 3 }, { id: 'd' }];
    const before = JSON.stringify(invoices);
    const plan = planInvoiceNumberBackfill(invoices);
    expect(plan).toMatchObject({ mode: 'dry-run', reviewRequired: true, readyForReview: false, counterFloor: 42 });
    expect(plan.issues).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'duplicate-number', invoiceIds: ['a', 'b'] }), expect.objectContaining({ type: 'invalid-number', invoiceId: 'd' })]));
    expect(plan.proposals).toEqual([expect.objectContaining({ invoiceId: 'c', expectedVersion: 3, reservationId: reservationId('CUSTOM'), createReservation: true })]);
    expect(planInvoiceNumberBackfill([...invoices].reverse())).toEqual(plan);
    expect(JSON.stringify(invoices)).toBe(before);
  });
  it('reports reservation conflicts, orphans, and old noncanonical hashes', () => {
    const invoices = [{ id: 'one', invoiceNumber: ' inv-0042 ' }];
    const reservations = [{ id: reservationId('INV-0042'), invoiceId: 'other' }, { id: 'old-hash', invoiceId: 'one' }];
    const plan = planInvoiceNumberBackfill(invoices, reservations);
    expect(plan.proposals).toEqual([]);
    expect(plan.issues.map(issue => issue.type)).toEqual(expect.arrayContaining(['reservation-conflict', 'orphan-reservation', 'noncanonical-reservation']));
    expect(planInvoiceNumberBackfill([{ id: 'one', invoiceNumber: 'INV-0042', invoiceNumberKey: 'INV-0042' }], [{ id: reservationId('INV-0042'), invoiceId: 'one', normalizedNumber: 'INV-0042' }])).toMatchObject({ proposals: [], issues: [], readyForReview: true });
  });
  it('preserves legacy identity and emits readable financial changes', () => {
    const event = financeActivity({ entity: 'invoices', entityId: 'legacy', action: 'invoice.reconcile', user: { uid: 'admin', email: 'admin@example.test' }, before: { clientId: 'legacy-client', invoiceNumber: 'OLD-1', adjustmentCents: -15000 }, patch: { adjustmentCents: 0, amountPaid: 0 }, reason: 'Receipt reversed', stamp: 'now' });
    expect(event).toMatchObject({ contactId: 'legacy-client', clientId: 'legacy-client', entityId: 'legacy', recordLabel: 'OLD-1', actor: 'admin', actorName: 'admin@example.test', reason: 'Receipt reversed' });
    expect(event.details).toContain('Balance adjustment: $-150.00 → $0.00');
  });
});

describe('financial link choices', () => {
  const contacts = [{ id: 'active' }, { id: 'archived', archivedAt: 1 }, { id: 'other-archived', archivedAt: 1 }];
  const invoices = [{ id: 'retained', clientId: 'archived', archivedAt: 1 }, { id: 'new-link', contactId: 'archived' }, { id: 'active-invoice', contactId: 'active' }, { id: 'archived-invoice', contactId: 'active', archivedAt: 1 }];
  it('always targets the Firestore document even when stored data has a conflicting id', () => {
    expect(financialRecord({ id: 'authoritative', data: () => ({ id: 'wrong-record', version: 1 }) })).toEqual({ id: 'authoritative', version: 1 });
  });
  it('offers active records for new links and only the retained archived client and invoice for corrections', () => {
    const payment = { clientId: 'archived', invoiceId: 'retained' };
    expect(financialClientOptions(contacts, null).map(contact => contact.id)).toEqual(['active']);
    expect(financialClientOptions(contacts, payment).map(contact => contact.id)).toEqual(['active', 'archived']);
    expect(paymentInvoiceOptions(invoices, 'archived', payment, contacts).map(invoice => invoice.id)).toEqual(['retained']);
    expect(paymentInvoiceOptions(invoices, 'active', payment, contacts).map(invoice => invoice.id)).toEqual(['active-invoice']);
    expect(paymentInvoiceOptions(invoices, '', null, contacts)).toEqual([]);
  });
  it('keeps unloaded existing links visible without offering additional archived links', () => {
    const payment = { clientId: 'unloaded', invoiceId: 'unloaded-invoice', contactName: 'Legacy Client' };
    expect(financialClientOptions([], payment)).toEqual([expect.objectContaining({ id: 'unloaded', retainedOnly: true })]);
    expect(paymentInvoiceOptions([], 'unloaded', payment, [])).toEqual([expect.objectContaining({ id: 'unloaded-invoice', retainedOnly: true })]);
    expect(paymentInvoiceOptions([], 'active', payment, contacts)).toEqual([]);
  });
});
