import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('../../HSP CRM/functions/node_modules/firebase-admin');
const { execute: finance } = require('../../HSP CRM/functions/handlers/finance');
const { execute: operations } = require('../../HSP CRM/functions/handlers/operations');
test.describe.configure({ mode: 'serial' });
test.skip(process.env.VITE_USE_EMULATORS !== 'true', 'Run test:workflows with local Firebase emulators.');
let db, app;
const contactId = 'workflow-client';
const crmPath = path => `${process.env.CRM_WORKFLOW_BASE_PATH ?? '/crm'}${path}`;
test.beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:') || !process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw new Error('Local emulators required.');
  app = admin.initializeApp({ projectId: 'demo-hsst' }, 'ui-workflows'); db = app.firestore();
  if (!process.env.HSST_EMULATOR_PASSWORD) throw new Error('Use npm run test:workflows to generate isolated test credentials.');
  await app.auth().createUser({ uid: 'UJjwxRbDcBTt2zukR9fl3MjkKur2', email: 'bhinrichs1380@gmail.com', emailVerified: true, password: process.env.HSST_EMULATOR_PASSWORD });
  await db.collection('contacts').doc(contactId).set({ firstName: 'Workflow', lastName: 'Client', email: 'workflow@example.test', status: 'client', archivedAt: null, createdAt: admin.firestore.FieldValue.serverTimestamp(), version: 0 });
});
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  for (const [endpoint, handler] of [['finance', finance], ['operations', operations]]) {
    await page.route(`**/api/${endpoint}`, async route => {
      try { const result = await handler(db, { uid: 'UJjwxRbDcBTt2zukR9fl3MjkKur2' }, route.request().postDataJSON()); await route.fulfill({ status: 200, json: result }); }
      catch (error) { await route.fulfill({ status: error.status || 500, json: { error: error.message } }); }
    });
  }
  await page.route('**/api/summary', route => route.fulfill({ json: { integrations: { campaignSending: false }, stats: { activeClients: 1, unreconciled: 0, outstanding: 0, monthPaid: 0 }, tasks: [], overdue: [], followups: [], capacity: [], recentPayments: [] } }));
  await page.goto(crmPath('/login'));
  await page.getByLabel('Email Address', { exact: true }).fill('bhinrichs1380@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill(process.env.HSST_EMULATOR_PASSWORD);
  await page.getByRole('button', { name: 'Access Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Today’s workspace' })).toBeVisible();
});
test('creates an invoice and payment, archives and restores both, and reconciles an archived-invoice reversal', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(crmPath('/invoices'));
  await page.getByRole('button', { name: 'New invoice', exact: true }).click();
  await page.getByLabel('CRM client').selectOption(contactId);
  await page.getByRole('button', { name: /Save|Create invoice/ }).last().click();
  await expect(page.getByText('Invoice created.', { exact: true })).toBeVisible();
  const invoice = (await db.collection('invoices').where('contactId', '==', contactId).get()).docs[0];
  expect(invoice.data().total).toBe(150);
  await page.goto(crmPath('/payments'));
  await page.getByRole('button', { name: 'Log payment', exact: true }).click();
  await page.getByRole('combobox', { name: 'Client required', exact: true }).selectOption(contactId);
  await page.getByRole('combobox', { name: 'Invoice (optional)', exact: true }).selectOption(invoice.id);
  await page.getByLabel('Amount', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Save payment', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await invoice.ref.get()).data().creditAmount).toBe(50);
  page.once('dialog', dialog => dialog.accept('Archive regression'));
  await page.getByRole('button', { name: 'Archive payment from Workflow Client', exact: true }).click();
  await page.getByText('Show archived payments', { exact: false }).click();
  await expect(page.getByRole('button', { name: 'Restore payment from Workflow Client', exact: true })).toBeVisible();
  expect((await invoice.ref.get()).data().amountPaid).toBe(200);
  const payment = (await db.collection('payments').where('invoiceId', '==', invoice.id).get()).docs[0];
  page.once('dialog', dialog => dialog.accept('Restore regression'));
  await page.getByRole('button', { name: 'Restore payment from Workflow Client', exact: true }).click();
  await expect.poll(async () => (await payment.ref.get()).data().archivedAt).toBeNull();
  expect((await invoice.ref.get()).data()).toMatchObject({ amountPaid: 200, creditAmount: 50 });

  // Create the negative adjustment that previously made a reversal impossible.
  await page.goto(crmPath('/invoices'));
  await page.getByRole('button', { name: `Edit ${invoice.data().invoiceNumber}`, exact: true }).click();
  let editor = page.getByRole('dialog');
  await editor.getByRole('checkbox', { name: 'Apply a verified balance correction' }).check();
  await editor.getByLabel('Amount paid correction', { exact: true }).fill('50');
  await editor.getByLabel('Correction reason', { exact: true }).fill('Verified receipt includes a duplicate adjustment');
  await editor.getByRole('button', { name: 'Save invoice', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect((await invoice.ref.get()).data()).toMatchObject({ amountPaid: 50, adjustmentCents: -15000 });
  page.once('dialog', dialog => dialog.accept('Archive invoice regression'));
  await page.getByRole('button', { name: `Archive ${invoice.data().invoiceNumber}`, exact: true }).click();
  await page.getByRole('button', { name: 'Show archived invoices', exact: true }).click();
  await expect(page.getByRole('button', { name: `Restore ${invoice.data().invoiceNumber}`, exact: true })).toBeVisible();
  expect((await invoice.ref.get()).data()).toMatchObject({ amountPaid: 50, balanceDue: 100 });

  await page.goto(crmPath('/payments'));
  await page.getByRole('button', { name: 'Edit payment from Workflow Client', exact: true }).click();
  editor = page.getByRole('dialog');
  await expect(editor.getByRole('combobox', { name: 'Invoice (optional)', exact: true })).toHaveValue(invoice.id);
  await editor.getByRole('combobox', { name: 'Status', exact: true }).selectOption('reversed');
  await editor.getByRole('button', { name: 'Save payment', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('negative balance adjustment');
  expect((await payment.ref.get()).data().status).toBe('received');
  expect((await invoice.ref.get()).data()).toMatchObject({ amountPaid: 50, adjustmentCents: -15000 });
  await editor.getByRole('checkbox', { name: 'Reconcile this invoice with the payment correction' }).check();
  await editor.getByLabel('Verified amount paid after this change').fill('0');
  await editor.getByLabel('Reconciliation reason', { exact: true }).fill('Returned receipt; remove the overlapping adjustment');
  await editor.getByRole('button', { name: 'Save payment', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect((await payment.ref.get()).data()).toMatchObject({ status: 'reversed', invoiceId: invoice.id });
  expect((await invoice.ref.get()).data()).toMatchObject({ amountPaid: 0, balanceDue: 150, adjustmentCents: 0 });

  await page.goto(crmPath('/invoices'));
  await page.getByRole('button', { name: 'Show archived invoices', exact: true }).click();
  page.once('dialog', dialog => dialog.accept('Restore invoice regression'));
  await page.getByRole('button', { name: `Restore ${invoice.data().invoiceNumber}`, exact: true }).click();
  await expect.poll(async () => (await invoice.ref.get()).data().archivedAt).toBeNull();
  expect((await invoice.ref.get()).data()).toMatchObject({ amountPaid: 0, balanceDue: 150, invoiceNumber: invoice.data().invoiceNumber });
  const actions = (await db.collection('activity').where('contactId', '==', contactId).get()).docs.map(doc => doc.data().action);
  expect(actions).toEqual(expect.arrayContaining(['payment.archive', 'payment.restore', 'invoice.archive', 'invoice.restore', 'payment.reverse', 'invoice.reconcile']));
});
test('manages anniversary hours, tasks, and persistent drafts', async ({ page }) => {
  await page.goto(crmPath(`/clients/${contactId}`));
  await page.getByLabel('Original service start date').fill('2026-01-31');
  await page.getByRole('button', { name: 'Save anniversary' }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await page.getByLabel('Task', { exact: true }).fill('Update service page');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByText('Update service page', { exact: true })).toBeVisible();
  await page.getByLabel('Work date', { exact: true }).fill('2026-02-28');
  await page.getByLabel('Minutes', { exact: true }).fill('60');
  await page.getByLabel('Work performed').fill('Page improvements');
  await page.getByRole('button', { name: 'Log time', exact: true }).click();
  await expect(page.getByText('Page improvements', { exact: true })).toBeVisible();
  await page.goto(crmPath('/email'));
  await page.getByRole('button', { name: 'New draft' }).click();
  await page.getByLabel('Subject', { exact: true }).fill('Saved campaign draft');
  await page.getByLabel('Message', { exact: true }).fill('Not sent during testing.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saved campaign draft' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send campaign', exact: true })).toBeDisabled();
});
test('supports mobile keyboard navigation, dialog dismissal, and logout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('button', { name: 'Sign out' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
  await page.goto(crmPath('/invoices'));
  await page.getByRole('button', { name: 'New invoice', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await drawer.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Access Dashboard' })).toBeVisible();
});
test.afterAll(async () => { await db?.terminate(); await app?.delete(); });
