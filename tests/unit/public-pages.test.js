import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES, SITE_ORIGIN, publicPageInputs, renderSitemap } from '../../src/scripts/site-pages.js';
import { publicPagesPlugin, renderPublicPage } from '../../src/components/public-pages-plugin.js';

describe('public page inventory', () => {
  it('renders complete static navigation, current pages and footer on every public page', () => {
    for (const page of PUBLIC_PAGES) {
      const source = readFileSync(page.file, 'utf8');
      const html = renderPublicPage(source, page.file);
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(document.querySelectorAll('header')).toHaveLength(1);
      expect(document.querySelectorAll('footer')).toHaveLength(1);
      expect(document.querySelectorAll('.skip-link')).toHaveLength(1);
      expect(document.querySelector('.nav-brand-image')?.getAttribute('src')).toBe('/images/hsst-logo-96.webp');
      expect(document.querySelector('.nav-toggle')?.tagName).toBe('BUTTON');
      expect(document.querySelectorAll('.nav-menu [aria-current=page]')).toHaveLength(page.nav ? 1 : 0);
      if (page.nav) expect(document.querySelector('.nav-menu [aria-current=page]').textContent).toBe(page.label);
      expect(document.querySelectorAll('footer a[href="portfolio.html"]')).toHaveLength(1);
      for (const area of ['header', 'footer']) {
        const admin = document.querySelector(`${area} a[href="/crm/login"]`);
        expect(admin?.textContent).toBe('Admin CRM');
        expect(admin?.getAttribute('target')).toBeNull();
      }
      expect(html).not.toMatch(/<!-- (public-header|public-footer|\w+-links|admin-link) -->/);
      expect(renderPublicPage(html, page.file)).toBe(html);
    }
  });

  it('publishes precisely the indexable inventory and leaves CRM/retired pages outside the transform', () => {
    const sitemap = new DOMParser().parseFromString(renderSitemap(), 'application/xml');
    expect([...sitemap.querySelectorAll('loc')].map(node => node.textContent)).toEqual(
      PUBLIC_PAGES.filter(page => page.indexable !== false).map(page => `${SITE_ORIGIN}${page.canonical || `/${page.file}`}`),
    );
    expect(Object.values(publicPageInputs)).toEqual(PUBLIC_PAGES.map(page => `./${page.file}`));
    const source = '<!-- public-header --><main>Retired page</main><!-- public-footer -->';
    expect(renderPublicPage(source, 'enrollment.html')).toBe(source);
  });

  it('emits the same sitemap in the public build', () => {
    const assets = [];
    publicPagesPlugin().generateBundle.call({ emitFile: asset => assets.push(asset) });
    expect(assets).toEqual([{ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap() }]);
  });
});
