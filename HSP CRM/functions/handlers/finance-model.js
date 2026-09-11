const fail = (message) => { const error = new Error(message); error.status = 400; throw error; };
function cents(value, label = 'Amount', signed = false) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) fail(`${label} must be a valid amount.`);
  const number = Number(value);
  if (!Number.isFinite(number) || (!signed && number < 0) || Math.abs(number) > 1e9) fail(`${label} must be a valid amount.`);
  return Math.round((number + Number.EPSILON) * 100);
}
function text(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Enter a valid date.');
  return value;
}
function invoiceFields(data) {
  const clientName = text(data.clientName);
  if (!clientName || !Array.isArray(data.items) || !data.items.length || data.items.length > 100) fail('A client and 1–100 invoice items are required.');
  const items = data.items.map(item => {
    const description = text(item.description, 1000);
    const rateCents = cents(item.rate, 'Rate');
    const qty = Number(item.qty ?? 1), hours = Number(item.hours || 0), minutes = Number(item.minutes || 0);
    if (!description || !Number.isFinite(qty) || qty <= 0 || qty > 100000 || !Number.isInteger(hours) || hours < 0 || hours > 100000 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) fail('Check item description, quantity, hours, and minutes.');
    if (item.isHourly && hours * 60 + minutes <= 0) fail('Hourly items require time greater than zero.');
    return { description, rate: rateCents / 100, qty, hours, minutes, isHourly: Boolean(item.isHourly) };
  });
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(cents(item.rate) * (item.isHourly ? (item.hours * 60 + item.minutes) / 60 : item.qty)), 0);
  const taxPct = Number(data.taxPct || 0);
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) fail('Tax must be between 0 and 100 percent.');
  const taxCents = Math.round(subtotalCents * taxPct / 100), totalCents = subtotalCents + taxCents;
  if (totalCents <= 0 || totalCents > 1e11) fail('Invoice total is out of range.');
  const issueDate = date(data.issueDate), dueDate = date(data.dueDate);
  if (dueDate < issueDate) fail('Due date cannot precede the issue date.');
  const clientEmail = text(data.clientEmail, 180);
  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) fail('Enter a valid client email.');
  return { clientName, clientEmail, contactId: text(data.contactId ?? data.clientId), issueDate, dueDate, items, taxPct, subtotal: subtotalCents / 100, tax: taxCents / 100, total: totalCents / 100, totalCents, notes: text(data.notes, 4000) };
}
function receivedCents(payment) { return payment.status === 'received' ? cents(payment.amount) : 0; }
function paymentState(totalCents, received, adjustment = 0, lifecycle = 'sent') {
  if (![totalCents, received, adjustment].every(Number.isSafeInteger) || totalCents < 0 || received < 0 || !Number.isSafeInteger(received + adjustment)) fail('Ledger amounts must be valid integer cents.');
  const net = received + adjustment;
  if (net < 0) fail('This correction would produce a negative paid amount.');
  const balanceCents = Math.max(0, totalCents - net), creditCents = Math.max(0, net - totalCents);
  const paymentStatus = net === 0 ? 'unpaid' : balanceCents ? 'partially_paid' : 'paid';
  return { amountPaid: net / 100, receivedCents: received, adjustmentCents: adjustment, balanceDue: balanceCents / 100, creditAmount: creditCents / 100, paymentStatus, status: paymentStatus === 'unpaid' ? (['draft', 'overdue'].includes(lifecycle) ? lifecycle : 'sent') : paymentStatus, accountingVersion: 2, reconciliationRequired: false };
}
function paymentFields(data) {
  const amountCents = cents(data.amount);
  if (!amountCents || !text(data.contactId)) fail('Choose a client and enter a positive payment.');
  if (!['venmo', 'cash-app', 'check', 'wire', 'zelle', 'cash', 'other'].includes(data.method)) fail('Choose an accepted payment method.');
  if (!['received', 'pending', 'reversed'].includes(data.status)) fail('Choose a valid payment status.');
  return { contactId: text(data.contactId), invoiceId: text(data.invoiceId), amount: amountCents / 100, paymentDate: date(data.paymentDate), method: data.method, status: data.status, reference: text(data.reference), notes: text(data.notes, 2000) };
}
module.exports = { fail, cents, text, date, invoiceFields, receivedCents, paymentState, paymentFields };
