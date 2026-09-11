import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('../../HSP CRM/functions/node_modules/firebase-admin');
const financeHandler = require('../../HSP CRM/functions/handlers/finance');
const identity = require('../../HSP CRM/functions/data/admin-identity.json');
let app, db, invoiceId, paymentId;
const clientId = `finance-browser-${Date.now()}`;
const user = { uid: identity.uid, email: identity.email };
const request = (action, data, rest = {}) => ({ action, data, requestId: crypto.randomUUID(), ...rest });
const password = process.env.HSST_EMULATOR_PASSWORD;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) throw new Error('Local emulators required.');
  process.env.ALLOWED_ORIGIN = 'http://127.0.0.1:4187';
  app = admin.initializeApp({ projectId: 'demo-hsst' }); db = app.firestore();
  try { await app.auth().createUser({ uid: identity.uid, email: identity.email, emailVerified: true, password }); }
  catch (error) { if (error.code !== 'auth/uid-already-exists' && error.code !== 'auth/email-already-exists') throw error; }
  await db.collection('contacts').doc(clientId).set({ firstName: 'Finance', lastName: 'Repair' });
  await db.collection('contacts').doc(`${clientId}-other`).set({ firstName: 'Other', archivedAt: 1 });
  const invoice = await financeHandler.execute(db, user, request('invoice.save', { contactId: clientId, clientName: 'Finance Repair', invoiceNumber: `BROWSER-${Date.now()}`, issueDate: '2026-09-01', dueDate: '2026-09-15', items: [{ description: 'Care', qty: 1, rate: 150 }] }));
  invoiceId = invoice.id;
  const payment = await financeHandler.execute(db, user, request('payment.save', { contactId: clientId, invoiceId, amount: 200, status: 'received', paymentDate: '2026-09-07', method: 'check' }));
  paymentId = payment.id;
  const current = (await db.collection('invoices').doc(invoiceId).get()).data();
  await financeHandler.execute(db, user, request('invoice.save', { ...current, correctedAmountPaid: 50, correctionReason: 'Duplicate adjustment under review' }, { id: invoiceId, expectedVersion: current.version }));
  await db.collection('contacts').doc(clientId).update({ archivedAt: 1 });
  await db.collection('invoices').doc(invoiceId).update({ archivedAt: 1, clientId, contactId: admin.firestore.FieldValue.delete() });
  // Stored IDs must never redirect a correction to a different document with the same version.
  const sourcePayment = (await db.collection('payments').doc(paymentId).get()).data();
  await db.collection('payments').doc(`${paymentId}-decoy`).set({ ...sourcePayment, invoiceId: '', contactName: 'Decoy Payment' });
  await db.collection('payments').doc(paymentId).update({ id: `${paymentId}-decoy` });
  const sourceInvoice = (await db.collection('invoices').doc(invoiceId).get()).data();
  await db.collection('invoices').doc(`${invoiceId}-decoy`).set({ ...sourceInvoice, invoiceNumber: `${sourceInvoice.invoiceNumber}-DECOY` });
  await db.collection('invoices').doc(invoiceId).update({ id: `${invoiceId}-decoy` });
});
test.afterAll(async () => { await db?.terminate(); await app?.delete(); });
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/finance', async route => {
    const headers = {}, res = {
      statusCode: 200,
      setHeader(key, value) { headers[key] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { return route.fulfill({ status: this.statusCode, headers, json: body }); },
      end() { return route.fulfill({ status: this.statusCode, headers, body: '' }); },
    };
    // Exercise the exported HTTP handler, including auth, CORS and request validation.
    const req = route.request();
    await financeHandler({ method: req.method(), headers: await req.allHeaders(), body: req.method() === 'POST' ? req.postDataJSON() : {} }, res);
  });
  await page.route('**/api/summary', route => route.fulfill({ json: { integrations: {}, stats: {}, paymentAggregates: { complete: true, scope: 'all-records', includesArchived: true, timeZone: 'America/Chicago', month: '2026-09', receivedThisMonth: 1234, receivedAllTime: 5678 }, tasks: [], overdue: [], followups: [], capacity: [], recentPayments: [] } }));
  await page.goto('/login');
  await page.getByLabel('Email Address', { exact: true }).fill(identity.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Access Dashboard' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
});

test('reverses an archived invoice payment using explicit reconciliation through the HTTP handler', async ({ page }) => {
  await page.goto('/payments');
  await page.getByRole('button', { name: 'Edit payment from Finance Repair', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Client required', exact: true })).toHaveValue(clientId);
  await expect(dialog.getByRole('combobox', { name: 'Invoice (optional)', exact: true })).toHaveValue(invoiceId);
  await expect(dialog.locator(`option[value="${clientId}-other"]`)).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('reversed');
  await dialog.getByRole('button', { name: 'Save payment', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('negative balance adjustment');
  expect((await db.collection('payments').doc(paymentId).get()).data().status).toBe('received');
  await dialog.getByRole('checkbox', { name: 'Reconcile this invoice with the payment correction' }).check();
  await dialog.getByLabel('Verified amount paid after this change').fill('0');
  await dialog.getByLabel('Reconciliation reason', { exact: true }).fill('Returned check; remove overlapping adjustment');
  await dialog.getByRole('button', { name: 'Save payment', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await db.collection('invoices').doc(invoiceId).get()).data()).toMatchObject({ amountPaid: 0, balanceDue: 150, adjustmentCents: 0 });
  expect((await db.collection('payments').doc(`${paymentId}-decoy`).get()).data().status).toBe('received');
});

test('retains legacy archived invoice clients and applies only an explicitly enabled paid correction', async ({ page }) => {
  await page.goto('/invoices');
  await page.getByRole('button', { name: 'Show archived invoices', exact: true }).click();
  const number = (await db.collection('invoices').doc(invoiceId).get()).data().invoiceNumber;
  await page.getByRole('button', { name: `Edit ${number}`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('CRM client')).toHaveValue(clientId);
  await expect(dialog.getByLabel('Amount paid correction', { exact: true })).toBeDisabled();
  await dialog.getByLabel('Notes and terms').fill('Archived invoice correction reviewed');
  await dialog.getByRole('button', { name: 'Save invoice', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await db.collection('invoices').doc(invoiceId).get()).data().amountPaid).toBe(0);
  await page.getByRole('button', { name: `Edit ${number}`, exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Apply a verified balance correction' }).check();
  await dialog.getByLabel('Amount paid correction', { exact: true }).fill('10');
  await dialog.getByLabel('Correction reason', { exact: true }).fill('Verified separate cash receipt');
  await dialog.getByRole('button', { name: 'Save invoice', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await db.collection('invoices').doc(invoiceId).get()).data()).toMatchObject({ amountPaid: 10, adjustmentCents: 1000 });
  expect((await db.collection('invoices').doc(`${invoiceId}-decoy`).get()).data().amountPaid).toBe(50);
});

test('records archive and restore reasons while preserving payment effect', async ({ page }) => {
  await page.goto('/payments');
  page.once('dialog', dialog => dialog.accept('Closed record after correction'));
  await page.getByRole('button', { name: 'Archive payment from Finance Repair', exact: true }).click();
  await page.getByRole('checkbox', { name: /Show archived payments/ }).check();
  const restore = page.getByRole('button', { name: 'Restore payment from Finance Repair', exact: true });
  await expect(restore).toBeVisible();
  page.once('dialog', dialog => dialog.accept('Reopened for review'));
  await restore.click();
  await expect(restore).toHaveCount(0);
  const activity = (await db.collection('activity').where('entityId', '==', paymentId).get()).docs.map(doc => doc.data());
  expect(activity).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'payment.archive', reason: 'Closed record after correction' }), expect.objectContaining({ action: 'payment.restore', reason: 'Reopened for review' })]));
  expect((await db.collection('invoices').doc(invoiceId).get()).data().amountPaid).toBe(10);
});

test('keeps complete account totals independent of loaded payment filters', async ({ page }) => {
  await page.goto('/payments');
  await expect(page.getByText('$1,234.00', { exact: true })).toBeVisible();
  await expect(page.getByText('$5,678.00', { exact: true })).toBeVisible();
  await page.getByLabel('Search payments').fill('no matching payment');
  await expect(page.getByText('No payments match these filters.', { exact: true })).toBeVisible();
  await expect(page.getByText('$1,234.00', { exact: true })).toBeVisible();
  await expect(page.getByText('$5,678.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Received subtotal · loaded and filtered', { exact: true })).toBeVisible();
});
