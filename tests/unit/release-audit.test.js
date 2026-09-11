import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditRelease } from '../../scripts/check-release.mjs';
import { PUBLIC_PAGES, SITE_ORIGIN, renderSitemap } from '../../src/scripts/site-pages.js';
import { renderPublicPage } from '../../src/components/public-pages-plugin.js';

const fixtures = [];
afterEach(() => fixtures.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true })));

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'hsst-release-test-'));
  fixtures.push(directory);
  const write = (name, content) => writeFileSync(join(directory, name), content);
  mkdirSync(join(directory, 'images'));
  mkdirSync(join(directory, 'assets'));
  mkdirSync(join(directory, 'crm/assets'), { recursive: true });
  for (const page of PUBLIC_PAGES) {
    write(page.file, renderPublicPage(`<!doctype html><html lang="en"><head><title>${page.label}</title>
      <meta name="description" content="Fixture page"><meta name="robots" content="${page.indexable === false ? 'noindex' : 'index'}, follow">
      <link rel="canonical" href="${SITE_ORIGIN}${page.canonical || `/${page.file}`}"></head><body>
      <!-- public-header --><main id="main-content"><h1>${page.label}</h1></main><!-- public-footer --></body></html>`, page.file));
  }
  for (const name of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'images/hsst-logo-96.webp']) write(name, 'fixture');
  write('robots.txt', readFileSync('robots.txt', 'utf8'));
  write('.htaccess', readFileSync('public/.htaccess', 'utf8'));
  write('sitemap.xml', renderSitemap());
  write('crm/index.html', '<!doctype html><html><head><meta name="robots" content="noindex,nofollow"></head><body><script src="/crm/assets/app.js"></script></body></html>');
  write('crm/assets/app.js', '// production fixture');
  return { directory, write, change: (name, update) => write(name, update(readFileSync(join(directory, name), 'utf8'))) };
}

describe('release artifact audit', () => {
  it('accepts a complete artifact and validates all inventory pages, including success', () => {
    const { directory } = fixture();
    expect(auditRelease(directory)).toMatchObject({ pages: 12, sitemapPages: 11, failures: [] });
  });

  it('reports duplicate IDs, document structure, canonical tags and loaded scripts', () => {
    const { directory, change, write } = fixture();
    write('assets/example.js', '// fixture');
    change('index.html', html => html.replace('</body>', '<main id="main-content"></main><script src="/assets/example.js?v=1"></script><script src="/assets/example.js?v=2"></script></body>')
      .replace('</head>', `<link rel="canonical" href="${SITE_ORIGIN}/"></head><head></head>`));
    const { failures } = auditRelease(directory);
    expect(failures).toEqual(expect.arrayContaining([
      '/: duplicate ID main-content', '/: expected one main', '/: expected one head element',
      '/: expected one link[rel="canonical"]', '/: duplicate loaded asset /assets/example.js',
    ]));
  });

  it('checks responsive/social/CSS assets, anchors, malformed paths and sitemap duplication', () => {
    const { directory, change, write } = fixture();
    write('assets/site.css', '.hero { background: url("../images/missing-background.webp") }');
    change('index.html', html => html.replace('</head>', '<link rel="stylesheet" href="/assets/site.css"><meta property="og:image" content="/images/missing-social.webp"></head>')
      .replace('</main>', '<img srcset="/images/missing-small.webp 320w, /images/missing-large.webp 768w"><a href="/contact.html#absent">Contact</a><img src="/%E0%A4%A"></main>'));
    change('sitemap.xml', xml => xml.replace('</urlset>', `<url><loc>${SITE_ORIGIN}/</loc></url></urlset>`));
    const { failures } = auditRelease(directory);
    expect(failures).toEqual(expect.arrayContaining([
      '/assets/site.css -> missing /images/missing-background.webp', '/ -> missing /images/missing-social.webp',
      '/ -> missing /images/missing-small.webp', '/ -> missing /images/missing-large.webp',
      '/ -> missing anchor /contact.html#absent', '/: invalid asset path /%E0%A4%A', 'Duplicate sitemap URLs',
    ]));
  });

  it('fails clearly for missing CRM output and permits it only in explicit public-only mode', () => {
    const { directory } = fixture();
    rmSync(join(directory, 'crm'), { recursive: true });
    expect(auditRelease(directory).failures).toEqual(expect.arrayContaining(['Missing crm/index.html', 'Missing crm/assets']));
    expect(auditRelease(directory, { publicOnly: true }).failures).toEqual([]);
  });

  it('rejects a crawl-blocked CRM and success accidentally indexed or listed in the sitemap', () => {
    const { directory, change } = fixture();
    change('robots.txt', text => `${text}\nDisallow: /crm/\n`);
    change('success.html', html => html.replace('content="noindex, follow"', 'content="index, follow"'));
    change('sitemap.xml', xml => xml.replace('</urlset>', `<url><loc>${SITE_ORIGIN}/success.html</loc></url></urlset>`));
    expect(auditRelease(directory).failures).toEqual(expect.arrayContaining([
      'robots.txt prevents crawlers reading CRM noindex', '/success.html: incorrect indexing policy', `Unexpected sitemap URL ${SITE_ORIGIN}/success.html`,
    ]));
  });
});
