import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Aspire Impact Network/);
  });

  test('should display hero section', async ({ page }) => {
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('Empowering People');
  });

  test('should have working navigation', async ({ page }) => {
    await page.click('a[href="/digital-solutions.html"]');
    await expect(page).toHaveURL(/digital-solutions/);
  });

  test('should display main panels', async ({ page }) => {
    const panels = page.locator('.panel');
    await expect(panels).toHaveCount(2);
  });

  test('should have accessible navigation', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toHaveAttribute('role', 'navigation');
  });

  test('should handle mobile menu toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const menuToggle = page.locator('.nav-toggle');
    await menuToggle.click();

    const navMenu = page.locator('.nav-menu');
    await expect(navMenu).toHaveClass(/active/);
  });

  test('should have skip to main content link', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
  });
});
