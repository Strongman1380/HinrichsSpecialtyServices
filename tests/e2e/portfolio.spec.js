import { test, expect } from '@playwright/test';

const projects = [
  ['General Exteriors', 'https://general-exteriors-lincoln.web.app/'],
  ['Renewed Horizon', 'https://renewed-horizon.web.app/'],
  ['AB Lawn Pros', 'https://ab-lawn-pros.web.app/'],
  ['Privacy Fence Construction', 'https://privacy-fence-construction.web.app/'],
  ['Lemke-Michels Psychotherapy', 'https://yorktherapists.web.app/'],
  ['Coaching With Michelle', 'https://coaching-with-michelle.web.app/'],
];

test('portfolio shows only the curated websites with loaded images and safe destinations', async ({ page }) => {
  await page.goto('/portfolio.html');
  await expect(page).toHaveTitle('Website Portfolio | Hinrichs Specialty Services and Technology');
  const cards = page.locator('.portfolio-project');
  await expect(cards).toHaveCount(projects.length);
  for (const [index, [name, url]] of projects.entries()) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(name);
    for (const link of await card.getByRole('link').all()) {
      await expect(link).toHaveAttribute('href', url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('main')).not.toContainText(/DB Enterprises|Wallflour|Florez|We Are Recovery|Weber Behavioral|CWM CRM/);
  await expect(page.locator('main iframe')).toHaveCount(0);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://www.hinrichsspecialtyservices.com/portfolio.html');
  await expect(page.locator('.nav-menu a[aria-current=page]')).toHaveText('Portfolio');
  const socialImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  const imageResponse = await page.request.get(new URL(socialImage).pathname);
  expect(imageResponse.ok()).toBe(true);
  expect(imageResponse.headers()['content-type']).toContain('image/webp');
});

for (const width of [390, 820, 1440]) {
  test(`portfolio remains readable and navigable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/portfolio.html');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Built for the people behind the business.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const first = await page.locator('.portfolio-project').nth(0).boundingBox();
    const second = await page.locator('.portfolio-project').nth(1).boundingBox();
    if (width <= 700) expect(second.y).toBeGreaterThan(first.y + first.height);
    else expect(Math.abs(second.y - first.y)).toBeLessThan(2);
    const header = await page.locator('.header').boundingBox();
    const logo = await page.locator('.nav-brand-image').boundingBox();
    expect(logo.y).toBeGreaterThanOrEqual(header.y);
    expect(logo.y + logo.height).toBeLessThanOrEqual(header.y + header.height + 1);
    await page.keyboard.press(process.platform === 'darwin' && /webkit|Safari/.test(test.info().project.name) ? 'Alt+Tab' : 'Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    if (width <= 1100) {
      const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.nav-menu a[href="portfolio.html"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    await page.getByRole('link', { name: 'Discuss your website' }).first().click();
    await expect(page).toHaveURL(/contact.html\?service=website-care/);
    await expect(page.locator('#contactForm [name=interest]')).toHaveValue('website-care');
  });
}

test('public pages expose portfolio navigation and footer links', async ({ page }) => {
  for (const name of ['index', 'our-story', 'digital-solutions', 'contact', 'success', 'privacy', 'terms', 'data-deletion', 'virtual-assistance', 'links']) {
    await page.goto(`/${name}.html`);
    await expect(page.locator('.nav-menu a[href="portfolio.html"]')).toHaveCount(1);
    await expect(page.locator('footer a[href="portfolio.html"]')).toHaveCount(1);
    if (['index', 'digital-solutions'].includes(name)) {
      await page.getByRole('link', { name: 'Explore the portfolio', exact: false }).first().click();
      await expect(page).toHaveURL(/portfolio.html/);
    }
  }
});
