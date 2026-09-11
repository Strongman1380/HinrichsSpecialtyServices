import { test, expect } from '@playwright/test';
test('service selector explains scope and prefills a real inquiry', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('I need help with').selectOption('virtual-assistance');
  await expect(page.locator('#service-explanation')).toContainText('custom VA');
  await page.getByRole('button', { name: 'Tell us what needs doing' }).click();
  await expect(page.locator('#interest')).toHaveValue('virtual-assistance');
});
test('navigation branding stays in the header and floating controls do not overlap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const header = await page.locator('.header').boundingBox();
  const logo = await page.locator('.nav-brand-image').boundingBox();
  expect(logo.y).toBeGreaterThanOrEqual(header.y);
  expect(logo.y + logo.height).toBeLessThanOrEqual(header.y + header.height + 1);
  await expect(page.locator('.admin-portal-fab')).toBeHidden();
});
test('a failed contact request retries with the same request identifier', async ({ page }) => {
  let calls = [];
  await page.route('**/api/create-lead', route => { calls.push(route.request().postDataJSON()); return route.fulfill({ status: calls.length === 1 ? 503 : 200, json: calls.length === 1 ? { error: 'Temporarily unavailable' } : { success: true, id: 'mock-lead' } }); });
  await page.goto('/contact.html');
  await page.locator('#firstName').fill('Retry'); await page.locator('#lastName').fill('Test');
  await page.locator('#contactForm input[type=email]').fill('retry@example.test');
  await page.locator('#interest').selectOption('website-care'); await page.locator('#message').fill('Please help with updates.'); await page.locator('#privacy').check();
  await page.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect(page.getByText(/could not be sent/)).toBeVisible();
  await page.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].requestId).toBe(calls[0].requestId);
});
test('chat offers a direct retry when lead persistence fails', async ({ page }) => {
  const calls = [];
  await page.route('**/api/chat', route => route.fulfill({ json: { content: 'I can request a follow-up. [LEAD:{"name":"Chat Test","email":"chat@example.test","interest":"Website care"}]' } }));
  await page.route('**/api/create-lead', route => { calls.push(route.request().postDataJSON()); return route.fulfill({ status: calls.length === 1 ? 503 : 200, json: calls.length === 1 ? { error: 'Temporary failure' } : { success: true, id: 'mock-chat-lead' } }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open chat', exact: true }).click();
  await page.locator('#hsst-chat-input').fill('Please ask Brandon to contact Chat Test at chat@example.test about website care.');
  await page.locator('#hsst-chat-send').click();
  const retry = page.getByRole('button', { name: 'Retry contact request', exact: true });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].requestId).toBe(calls[0].requestId);
  await expect(retry).toHaveCount(0);
});
