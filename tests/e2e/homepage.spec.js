import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Hinrichs Specialty Services/);
  });

  test('should display hero section', async ({ page }) => {
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('handled');
  });

  test('should have working navigation', async ({ page }) => {
    await page.locator('a[href="digital-solutions.html"]:visible').first().click();
    await expect(page).toHaveURL(/digital-solutions/);
  });

  test('should display the three-step service story', async ({ page }) => {
    const panels = page.locator('.service-stack-card');
    await expect(panels).toHaveCount(3);
  });

  test('should have accessible navigation', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(page.locator('.nav-brand-image')).toHaveAttribute('alt', 'Hinrichs Specialty Services and Technology');
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

  test('keeps Admin CRM on the same Hostinger origin', async ({ page }) => {
    const admin = page.locator('.nav-menu a[href="/crm/login"]');
    await expect(admin).not.toHaveAttribute('target', '_blank');
    expect(new URL(await admin.getAttribute('href'), page.url()).origin).toBe(new URL(page.url()).origin);
  });

  test('honors reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const reducedPage = await context.newPage();
    await reducedPage.goto('/');
    await expect(reducedPage.locator('.hero-title')).toBeVisible();
    expect(await reducedPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await context.close();
  });
});
