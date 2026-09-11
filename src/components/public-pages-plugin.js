import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_LINK, PUBLIC_PAGES, renderSitemap } from '../scripts/site-pages.js';

const layoutDirectory = dirname(fileURLToPath(import.meta.url));
const header = readFileSync(resolve(layoutDirectory, 'public-header.html'), 'utf8');
const footer = readFileSync(resolve(layoutDirectory, 'public-footer.html'), 'utf8');
const link = (page, currentFile, className = '') => `<a href="${page.href}"${className ? ` class="${className}${page.file === currentFile ? ' active' : ''}"` : ''}${page.file === currentFile ? ' aria-current="page"' : ''}>${page.label}</a>`;

export function renderPublicPage(html, filename) {
  const file = basename(filename.split('?')[0]);
  if (!PUBLIC_PAGES.some(page => page.file === file)) return html;
  if (!/class=["'][^"']*\bskip-link\b/.test(html)) html = html.replace(/<body\b[^>]*>/i, '$&\n<a href="#main-content" class="skip-link">Skip to main content</a>');
  html = html.replace(/<main\b(?![^>]*\bid=)([^>]*)>/i, '<main id="main-content" tabindex="-1"$1>');
  const nav = PUBLIC_PAGES.filter(page => page.nav).map(page => `<li>${link(page, file, 'nav-link')}</li>`);
  nav.push(`<li>${link(ADMIN_LINK, file, 'nav-link admin-crm-btn')}</li>`);
  let renderedFooter = footer;
  for (const group of ['Services', 'Explore', 'Legal']) {
    const links = PUBLIC_PAGES.filter(page => page.footer === group).map(page => link(page, file));
    renderedFooter = renderedFooter.replace(`<!-- ${group.toLowerCase()}-links -->`, group === 'Legal' ? links.join(' | ') : links.map(item => `<li>${item}</li>`).join('\n'));
  }
  renderedFooter = renderedFooter.replace('<!-- admin-link -->', link(ADMIN_LINK, file, 'admin-link'));
  return html.replace('<!-- public-header -->', header.replace('<!-- navigation-links -->', nav.join('\n')))
    .replace('<!-- public-footer -->', renderedFooter);
}

export function publicPagesPlugin() {
  return {
    name: 'public-page-inventory',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, context) => renderPublicPage(html, context.filename),
    },
    configureServer(server) {
      server.middlewares.use('/sitemap.xml', (_req, res) => {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.end(renderSitemap());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap() });
    },
  };
}
