const { text } = require('./finance-model');
const labels = {
  contactId: 'Client', clientId: 'Legacy client', invoiceId: 'Linked invoice', invoiceNumber: 'Invoice number',
  clientName: 'Client name', clientEmail: 'Client email', amount: 'Payment amount', amountPaid: 'Amount paid',
  receivedCents: 'Received payments', adjustmentCents: 'Balance adjustment', balanceDue: 'Balance due', creditAmount: 'Overpayment credit',
  total: 'Invoice total', taxPct: 'Tax percent', status: 'Status', paymentStatus: 'Payment status', paymentDate: 'Payment date',
  method: 'Payment method', reference: 'Reference', notes: 'Notes', issueDate: 'Issue date', dueDate: 'Due date',
  items: 'Invoice items', archivedAt: 'Archived', reconciliationRequired: 'Reconciliation required',
};
function readable(field, value) {
  if (field === 'archivedAt') return value ? 'Yes' : 'No';
  if (value == null || value === '') return 'None';
  if (['amount', 'amountPaid', 'balanceDue', 'creditAmount', 'total', 'receivedCents', 'adjustmentCents'].includes(field)) {
    return `$${(Number(value) / (field.endsWith('Cents') ? 100 : 1)).toFixed(2)}`;
  }
  if (field === 'items' && Array.isArray(value)) return value.map(item => item && typeof item === 'object' ? `${item.description}: ${item.isHourly ? `${item.hours || 0}h ${item.minutes || 0}m` : `${item.qty} ×`} $${Number(item.rate).toFixed(2)}` : String(item)).join('; ');
  return ['status', 'paymentStatus'].includes(field) ? String(value).replaceAll('_', ' ') : String(value);
}
function financeActivity({ entity, entityId, action, user, before, patch, reason = '', stamp, paymentId }) {
  const after = { ...before, ...patch };
  const contactId = after.contactId || after.clientId || before?.contactId || before?.clientId || '';
  const changes = Object.entries(labels).filter(([field]) => Object.hasOwn(patch, field) && JSON.stringify(before?.[field] ?? null) !== JSON.stringify(patch[field] ?? null))
    .map(([field, label]) => ({ field, label, before: readable(field, before?.[field]), after: readable(field, patch[field]) }));
  const recordLabel = entity === 'invoices' ? after.invoiceNumber || entityId : `${after.contactName || 'Payment'} · ${after.paymentDate || ''} · ${readable('amount', after.amount)}`;
  return {
    entity, entityId, recordLabel, contactId, clientId: before?.clientId || after.clientId || contactId,
    action, actor: user.uid, actorName: text(user.name || user.email || user.uid), reason: text(reason, 1000),
    details: changes.map(change => `${change.label}: ${change.before} → ${change.after}`).join('; ') || `${action} ${recordLabel}`,
    changes, before: before || null, after, createdAt: stamp, ...(paymentId ? { paymentId } : {}),
  };
}
module.exports = { financeActivity };
