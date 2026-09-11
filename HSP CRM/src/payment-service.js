import { adminRequest } from './api';
export const createPaymentRecord = data => adminRequest('/api/finance', { action: 'payment.save', data });
export const updatePaymentRecord = (id, data, expectedVersion = 0) => adminRequest('/api/finance', { action: 'payment.save', id, data, expectedVersion });
export const archivePaymentRecord = (payment, correctionReason = '') => adminRequest('/api/finance', { action: 'payment.archive', id: payment.id, expectedVersion: payment.version || 0, data: { archived: !payment.archivedAt, correctionReason } });
