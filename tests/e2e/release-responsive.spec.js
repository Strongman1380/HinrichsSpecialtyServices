import { test, expect } from '@playwright/test';
import { PUBLIC_PAGES } from '../../src/scripts/site-pages.js';

const publicErrors = new WeakMap();
test.beforeEach(async ({ page, baseURL }, testInfo) => {
  const errors = [];
  publicErrors.set(page, errors);
  const origin = new URL(baseURL).origin;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(`${origin}/`) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(`${origin}/`) && !/ERR_ABORTED|cancelled/i.test(request.failure()?.errorText || '')) errors.push(`Failed request ${request.url()}`);
  });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    if (url && !url.startsWith(`${origin}/`)) return;
    if (testInfo.annotations.some(annotation => annotation.type === 'expected-console-error' && message.text().startsWith(annotation.description))) return;
    errors.push(message.text());
  });
  // Keep third-party analytics/ads and unmocked API calls off the network.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});
test.afterEach(async ({ page }) => {
  try { expect(publicErrors.get(page)).toEqual([]); }
  finally { await page.unrouteAll({ behavior: 'wait' }); }
});

for (const width of [320, 390, 768, 1024, 1101, 1440]) {
  test(`all public pages fit and navigate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const entry of PUBLIC_PAGES) {
      await page.goto(`/${entry.file}`);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), entry.file).toBe(true);
      // A hidden body overflow must not conceal clipped content or controls.
      const clipped = await page.locator('main a, main h1, main h2, main p, main input, main select, main button, main textarea, footer a, .nav-logo-link').evaluateAll(elements => elements.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && rect.height && getComputedStyle(element).visibility !== 'hidden' && (rect.x < -1 || rect.right > innerWidth + 1);
      }).map(element => element.textContent.trim().slice(0, 50)));
      expect(clipped, entry.file).toEqual([]);
      const header = await page.locator('.header').boundingBox();
      const logo = await page.locator('.nav-brand-image').boundingBox();
      expect(logo.y, entry.file).toBeGreaterThanOrEqual(header.y);
      expect(logo.y + logo.height, entry.file).toBeLessThanOrEqual(header.y + header.height + 1);
      const nav = page.locator('.nav-menu');
      if (width <= 1100) {
        const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(nav.locator('a[href="portfolio.html"]')).toBeVisible();
        await nav.locator('a[href="portfolio.html"]').focus();
        await page.keyboard.press('Escape');
        await expect(toggle).toBeFocused();
        await expect(nav).toBeHidden();
      } else {
        const menu = await nav.boundingBox();
        const brand = await page.locator('.nav-logo-link').boundingBox();
        expect(menu.x, entry.file).toBeGreaterThanOrEqual(brand.x + brand.width);
        expect(menu.x + menu.width, entry.file).toBeLessThanOrEqual(width);
        await expect(nav.locator('a[href="/crm/login"]')).toBeVisible();
      }
      await expect(nav.locator('[aria-current=page]')).toHaveCount(entry.nav ? 1 : 0);
      await expect(page.locator('footer a[href="/crm/login"]')).toHaveText('Admin CRM');
      await expect(page.locator('footer a[href="portfolio.html"]')).toHaveCount(1);
    }
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`enlarged text, keyboard navigation and reduced motion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const file of ['index.html', 'portfolio.html', 'contact.html']) {
      await page.goto(`/${file}`);
      // Text resizing, not CSS transform/zoom: content must reflow at 200%.
      await page.addStyleTag({ content: 'html { font-size: 200% !important; } body { font-family: Arial, sans-serif !important; }' });
      await page.waitForLoadState('networkidle');
      const clipped = await page.locator('main h1, main h2, main p, main a, main button, main input, main select, main textarea, footer a, .nav-logo-link').evaluateAll(elements => elements.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && rect.height && (rect.x < -1 || rect.right > innerWidth + 1);
      }).map(element => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 50) })));
      expect(clipped, file).toEqual([]);
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, className: el.getAttribute('class'), text: el.textContent.trim().slice(0, 60), right: el.getBoundingClientRect().right })) }));
      expect(layout.scroll <= layout.width, `${file}: ${JSON.stringify(layout)}`).toBe(true);
      // Safari uses Option-Tab to include links when full keyboard access is off.
      await page.keyboard.press(process.platform === 'darwin' && /webkit|Safari/.test(test.info().project.name) ? 'Alt+Tab' : 'Tab');
      await expect(page.locator('.skip-link')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content')).toBeFocused();
      const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
      if (await toggle.isVisible()) {
        await toggle.focus();
        await page.keyboard.press('Space');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.locator('.nav-menu a[href="/crm/login"]').focus();
        await expect(page.locator('.nav-menu a[href="/crm/login"]')).toBeInViewport();
        await page.keyboard.press('Escape');
        await expect(toggle).toBeFocused();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
      await expect(page.locator('.nav-menu a[href="portfolio.html"]')).toHaveCount(1);
      const durations = await page.locator('h1').evaluate(element => ({ animation: getComputedStyle(element).animationDuration, transition: getComputedStyle(element).transitionDuration }));
      expect(parseFloat(durations.animation)).toBeLessThanOrEqual(0.001);
      expect(parseFloat(durations.transition)).toBeLessThanOrEqual(0.001);
    }
  });
}

test('logo and navigation are present without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(`${baseURL}/portfolio.html`);
  await expect(page.locator('.nav-brand-image')).toBeVisible();
  await expect(page.locator('.nav-menu a[aria-current=page]')).toHaveText('Portfolio');
  await page.locator('.nav-menu a[href="contact.html"]').click();
  await expect(page).toHaveURL(/contact.html$/);
  await context.close();
});

test('chat has accurate labels, focus and reduced motion at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open chat', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'HSST Chat Assistant' })).toBeVisible();
  await expect(page.getByLabel('Message to HSST Assistant')).toBeFocused();
  await expect(page.locator('#hsst-chat-header-info')).toContainText('FAQ help & contact requests');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const duration = await page.locator('#hsst-chat-window').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThanOrEqual(0.001);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('failed requests survive reload with all lead fields and one confirmed GA event', async ({ page }) => {
  test.info().annotations.push(
    { type: 'expected-console-error', description: 'Contact submission failed' },
    { type: 'expected-console-error', description: '[Database.submitLeadToCRM] CRM sync error:' },
  );
  const calls = [];
  await page.route('**/api/create-lead', route => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ status: calls.length === 1 ? 503 : 200, json: calls.length === 1 ? { error: 'Retry later' } : { success: true, id: 'public-test' } });
  });
  const fill = async () => {
    await page.locator('#firstName').fill('Reload');
    await page.locator('#lastName').fill('Retry');
    await page.locator('#email').fill('reload@example.test');
    await page.locator('#phone').fill('402-555-0123');
    await page.locator('#organization').fill('Example');
    await page.locator('#interest').selectOption('website-care');
    await page.locator('#budget').selectOption('website-social');
    await page.locator('#timeline').selectOption({ index: 1 });
    await page.locator('#message').fill('Please help with website updates.');
    await page.locator('#privacy').check();
  };
  await page.goto('/contact.html');
  await fill();
  await page.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect(page.getByText(/could not be sent/)).toBeVisible();
  expect(await page.evaluate(() => window.dataLayer.filter(args => args[1] === 'lead_creation').length)).toBe(0);
  await page.reload();
  await fill();
  await page.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[1]).toMatchObject({ serviceRange: 'website-social', privacyConsent: true, newsletterConsent: false, metadata: { company: 'Example' } });
  await expect.poll(() => page.evaluate(() => window.dataLayer.filter(args => args[1] === 'lead_creation').length)).toBe(1);
  const ga = await page.evaluate(() => window.dataLayer.map(args => [...args]));
  expect(ga.filter(args => args[0] === 'event' && args[1] === 'page_view')).toHaveLength(1);
  expect(ga.find(args => args[0] === 'config')[2].send_page_view).toBe(false);
});
