import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact.html');
  });

  test('displays and validates required fields', async ({ page }) => {
    const form = page.locator('form#contactForm');
    await expect(form).toBeVisible();
    await form.locator('button[type="submit"]').click();
    expect(await form.locator('input[name="firstName"]').evaluate((element) => !element.validity.valid)).toBe(true);
  });

  test('creates a CRM lead through the mocked protected endpoint', async ({ page }) => {
    let submitted;
    await page.route('**/api/create-lead', async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, id: 'lead-test' }) });
    });

    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="email"]', 'john.doe@example.com');
    await page.fill('input[name="phone"]', '402-555-1234');
    await page.selectOption('select[name="interest"]', 'website-care');
    await page.selectOption('select[name="budget"]', 'website-social');
    await page.selectOption('select[name="timeline"]', { index: 1 });
    await page.check('input[name="newsletter"]');
    await page.fill('textarea[name="message"]', 'I need help with my website.');
    await page.check('input[name="privacy"]');
    await page.click('button[type="submit"]');

    await expect.poll(() => submitted?.email).toBe('john.doe@example.com');
    expect(submitted.website).toBe('');
    expect(submitted.serviceRange).toBe('website-social');
    expect(submitted.timeline).toBeTruthy();
    expect(submitted.privacyConsent).toBe(true);
    expect(submitted.newsletterConsent).toBe(true);
    expect(submitted.requestId).toBeTruthy();
    await expect(page).toHaveURL(/success\.html/, { timeout: 3_000 });
  });

  test('shows a clear error when the endpoint rate-limits a submission', async ({ page }) => {
    await page.route('**/api/create-lead', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Too many submissions. Please try again later.' }) }));
    await page.fill('input[name="firstName"]', 'Rate');
    await page.fill('input[name="lastName"]', 'Limited');
    await page.fill('input[name="email"]', 'rate@example.com');
    await page.selectOption('select[name="interest"]', 'website-care');
    await page.fill('textarea[name="message"]', 'Please contact me.');
    await page.check('input[name="privacy"]');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/could not be sent/i)).toBeVisible();
  });
});
