import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
const require = createRequire(import.meta.url);
const { paymentState, invoiceFields, paymentFields } = require('../../HSP CRM/functions/handlers/finance-model');
const { servicePeriod, timeFields } = require('../../HSP CRM/functions/handlers/operations-model');
describe('financial invariants', () => {
  it('preserves overpayments and recalculates a reversal without losing money', () => {
    expect(paymentState(15000, 20000)).toMatchObject({ amountPaid: 200, creditAmount: 50, balanceDue: 0 });
    expect(paymentState(15000, 10000)).toMatchObject({ amountPaid: 100, creditAmount: 0, balanceDue: 50 });
  });
  it('derives paid status from the ledger, not an independent selection', () => {
    expect(paymentState(15000, 0, 0, 'paid')).toMatchObject({ status: 'sent', paymentStatus: 'unpaid', balanceDue: 150 });
    expect(paymentState(15000, 15000)).toMatchObject({ status: 'paid', balanceDue: 0 });
    expect(() => paymentState(15000, 0, -1)).toThrow();
    expect(paymentState(15000, 0, 0, 'overdue')).toMatchObject({ status: 'overdue' });
  });
  it('rejects invalid amounts and methods at the boundary', () => {
    expect(() => paymentFields({ amount: Infinity })).toThrow();
    expect(() => paymentFields({ amount: 1, contactId: 'client', method: 'stripe' })).toThrow();
    expect(() => invoiceFields({ clientName: 'Client', items: [{ description: 'Work', qty: 0, rate: 150 }] })).toThrow();
  });
});
describe('billing anniversary and capacity', () => {
  it('uses the original anniversary after a short month without drift', () => {
    expect(servicePeriod('2024-01-31', '2024-02-29')).toEqual({ start: '2024-02-29', end: '2024-03-31' });
    expect(servicePeriod('2025-01-31', '2025-03-30')).toEqual({ start: '2025-02-28', end: '2025-03-31' });
    expect(servicePeriod('2025-12-31', '2026-01-01')).toEqual({ start: '2025-12-31', end: '2026-01-31' });
  });
  it('rejects work before enrollment and unapproved additional time', () => {
    expect(() => servicePeriod('2026-09-10', '2026-09-09')).toThrow();
    expect(() => timeFields({ workDate: '2026-09-10', minutes: 60, scope: 'Updates', billing: 'additional', rate: 45 }, { startDate: '2026-09-01' })).toThrow();
    expect(timeFields({ workDate: '2026-09-10', minutes: 60, scope: 'Updates', billing: 'additional', rate: 45, approval: 'Client approved email', approvedOn: '2026-09-09' }, { startDate: '2026-09-01' })).toMatchObject({ rate: 45, minutes: 60, periodStart: '2026-09-01' });
  });
});
