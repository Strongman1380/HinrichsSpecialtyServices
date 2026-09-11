import { adminRequest } from './api';
export const createInvoiceRecord = data => adminRequest('/api/finance', { action: 'invoice.save', data });
export const updateInvoiceRecord = (id, data, expectedVersion = 0) => adminRequest('/api/finance', { action: 'invoice.save', id, data, expectedVersion });
export const archiveInvoiceRecord = (invoice, correctionReason = '') => adminRequest('/api/finance', { action: 'invoice.archive', id: invoice.id, expectedVersion: invoice.version || 0, data: { archived: !invoice.archivedAt, correctionReason } });
