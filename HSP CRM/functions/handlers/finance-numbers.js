const crypto = require('node:crypto');
const { fail } = require('./finance-model');

function normalizeInvoiceNumber(value) {
  if (typeof value !== 'string') fail('Invoice number must be text.');
  const number = value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!number || number.length > 80 || /[\x00-\x1f\x7f]/.test(number)) fail('Invoice number must contain 1–80 printable characters.');
  return number;
}
const reservationId = number => crypto.createHash('sha256').update(normalizeInvoiceNumber(number)).digest('hex');
function sequenceValue(number) {
  const value = Number(/^INV-(\d+)$/.exec(normalizeInvoiceNumber(number))?.[1] || 0);
  if (!Number.isSafeInteger(value)) fail('Invoice sequence is out of range.');
  return value;
}

// Pure dry-run proposal. Conflicts never select a winner; no writes are performed.
function planInvoiceNumberBackfill(invoices, reservations = []) {
  const groups = new Map(), issues = [], proposals = [];
  let counterFloor = 0;
  for (const invoice of [...invoices].sort((a, b) => a.id.localeCompare(b.id))) {
    try {
      const normalizedNumber = normalizeInvoiceNumber(invoice.invoiceNumber);
      counterFloor = Math.max(counterFloor, sequenceValue(normalizedNumber));
      const group = groups.get(normalizedNumber) || [];
      group.push(invoice);
      groups.set(normalizedNumber, group);
    } catch (error) { issues.push({ type: 'invalid-number', invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber ?? null, reason: error.message }); }
  }
  const existing = new Map(reservations.map(record => [record.id, record]));
  for (const [normalizedNumber, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const id = reservationId(normalizedNumber), reserved = existing.get(id);
    if (group.length > 1) {
      issues.push({ type: 'duplicate-number', normalizedNumber, invoiceIds: group.map(invoice => invoice.id), invoiceNumbers: group.map(invoice => invoice.invoiceNumber) });
      continue;
    }
    const invoice = group[0];
    if (reserved && (reserved.invoiceId !== invoice.id || (reserved.normalizedNumber && reserved.normalizedNumber !== normalizedNumber))) {
      issues.push({ type: 'reservation-conflict', normalizedNumber, reservationId: id, invoiceId: invoice.id, reservedInvoiceId: reserved.invoiceId ?? null });
      continue;
    }
    if (invoice.invoiceNumberKey !== normalizedNumber || !reserved || reserved.normalizedNumber !== normalizedNumber) {
      proposals.push({ invoiceId: invoice.id, expectedVersion: Number(invoice.version || 0), invoiceNumber: invoice.invoiceNumber, invoiceNumberKey: normalizedNumber, reservationId: id, reservation: { invoiceId: invoice.id, normalizedNumber }, createReservation: !reserved });
    }
  }
  for (const record of [...reservations].sort((a, b) => a.id.localeCompare(b.id))) {
    const invoice = invoices.find(item => item.id === record.invoiceId);
    if (!invoice) issues.push({ type: 'orphan-reservation', reservationId: record.id, invoiceId: record.invoiceId ?? null });
    else {
      try {
        if (record.id !== reservationId(invoice.invoiceNumber)) issues.push({ type: 'noncanonical-reservation', reservationId: record.id, invoiceId: invoice.id });
      } catch { /* Invalid invoice numbers are reported above. */ }
    }
  }
  return { mode: 'dry-run', reviewRequired: true, readyForReview: issues.length === 0, invoiceCount: invoices.length, reservationCount: reservations.length, counterFloor, proposals, issues };
}

module.exports = { normalizeInvoiceNumber, reservationId, sequenceValue, planInvoiceNumberBackfill };
