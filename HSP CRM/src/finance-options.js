export const financialClientId = record => record?.contactId || record?.clientId || '';
export const financialRecord = snapshot => ({ ...snapshot.data(), id: snapshot.id });

export function financialClientOptions(contacts, payment) {
  const retainedId = financialClientId(payment);
  const options = contacts.filter(contact => !contact.archivedAt || contact.id === retainedId);
  if (retainedId && !options.some(contact => contact.id === retainedId)) {
    options.push({ id: retainedId, company: payment.contactName || payment.clientName || retainedId, retainedOnly: true });
  }
  return options;
}

export function paymentInvoiceOptions(invoices, contactId, payment, contacts) {
  if (!contactId) return [];
  const client = contacts.find(contact => contact.id === contactId);
  const retainOriginal = contactId === financialClientId(payment);
  const options = invoices.filter(invoice => financialClientId(invoice) === contactId &&
    ((retainOriginal && invoice.id === payment?.invoiceId) || (!invoice.archivedAt && client && !client.archivedAt)));
  if (retainOriginal && payment?.invoiceId && !invoices.some(invoice => invoice.id === payment.invoiceId)) {
    options.push({ id: payment.invoiceId, invoiceNumber: payment.invoiceId, retainedOnly: true });
  }
  return options;
}
