import { expect, test } from '@playwright/test';

test.describe('same-origin CRM', () => {
  test('serves the branded CRM login from the website build', async ({ page }) => {
    await page.goto('/crm/');
    await expect(page).toHaveURL(/\/crm\/login$/);
    await expect(page.getByRole('heading', { name: /HSST Admin CRM/i })).toBeVisible();
    await expect(page.locator('img[alt="Hinrichs Specialty Services and Technology"]')).toBeVisible();
  });

  test('protects the Payments route when no administrator is signed in', async ({ page }) => {
    await page.goto('/crm/');
    await page.evaluate(() => {
      history.pushState({}, '', '/crm/payments');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/\/crm\/login$/);
  });
});
