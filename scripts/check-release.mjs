import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { PUBLIC_PAGES, SITE_ORIGIN } from '../src/scripts/site-pages.js';

// Read-only artifact audit. The default includes CRM; --public-only is explicit.
export function auditRelease(directory = 'dist', { publicOnly = false } = {}) {
  const root = path.resolve(directory);
  const failures = [];
  const documents = new Map();
  const checkedStyles = new Set();
  let references = 0, structured = 0;
  const fail = message => failures.push(message);
  const exists = file => fs.existsSync(file) && fs.statSync(file).isFile();
  const read = file => exists(file) ? fs.readFileSync(file, 'utf8') : null;
  const documentFor = file => {
    if (!documents.has(file)) documents.set(file, new JSDOM(fs.readFileSync(file, 'utf8')).window.document);
    return documents.get(file);
  };
  const fileFor = url => {
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
    if (pathname.includes('\0') || pathname.includes('\\')) return null;
    if (/^\/crm(?:\/|$)/.test(pathname) && !path.extname(pathname)) pathname = '/crm/index.html';
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return null;
    return !exists(file) && !path.extname(file) && exists(file + '.html') ? file + '.html' : file;
  };

  const checkReference = (value, base, from, { anchor = false } = {}) => {
    if (!value || /^(mailto:|tel:|data:|blob:)/i.test(value)) return;
    let url;
    try { url = new URL(value, base); } catch { fail(from + ': invalid URL ' + value); return; }
    if (/^javascript:/i.test(url.protocol)) { fail(from + ': unsafe URL ' + value); return; }
    if (url.origin !== SITE_ORIGIN) return;
    if (publicOnly && /^\/crm(?:\/|$)/.test(url.pathname)) return;
    references++;
    const file = fileFor(url);
    if (!file) { fail(from + ': invalid asset path ' + value); return; }
    if (!exists(file)) { fail(from + ' -> missing ' + url.pathname); return; }
    if (fs.statSync(file).size === 0) fail(from + ': empty asset ' + url.pathname);
    if (anchor && url.hash && file.endsWith('.html') && !url.hash.startsWith('#:~:text=')) {
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { fail(from + ': invalid anchor ' + url.hash); return; }
      if (!documentFor(file).getElementById(id)) fail(from + ' -> missing anchor ' + url.pathname + url.hash);
    }
    if (file.endsWith('.css') && !checkedStyles.has(file)) {
      checkedStyles.add(file);
      const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g)) {
        const reference = match[1] ?? match[2] ?? match[3];
        if (!reference.startsWith('#')) checkReference(reference, url, url.pathname);
      }
      for (const [, reference] of css.matchAll(/@import\s+["']([^"']+)["']/g)) checkReference(reference, url, url.pathname);
    }
  };

  const checkAssets = (document, url) => {
    const loadedAssets = new Set();
    for (const element of document.querySelectorAll('[href], [src], [srcset], [poster], meta[property="og:image"], meta[name="twitter:image"]')) {
      for (const attr of ['href', 'src', 'poster']) {
        const value = element.getAttribute(attr);
        if (value) checkReference(value, url, url.pathname, { anchor: attr === 'href' && element.tagName === 'A' });
      }
      const srcset = element.getAttribute('srcset');
      if (srcset && !srcset.trim().startsWith('data:')) {
        for (const candidate of srcset.split(',')) checkReference(candidate.trim().split(/\s+/)[0], url, url.pathname);
      }
      if (element.tagName === 'META') checkReference(element.getAttribute('content'), url, url.pathname);
      if (element.matches('script[src], link[rel="stylesheet"]')) {
        const value = element.getAttribute('src') || element.getAttribute('href');
        let asset;
        try { asset = new URL(value, url); } catch { continue; }
        // Cache-busting query strings do not make a second loader safe.
        const key = element.tagName + ':' + asset.origin + asset.pathname;
        if (loadedAssets.has(key)) fail(url.pathname + ': duplicate loaded asset ' + asset.pathname);
        loadedAssets.add(key);
      }
    }
  };

  const sitemapText = read(path.join(root, 'sitemap.xml'));
  let sitemapURLs = [];
  if (sitemapText === null) fail('Missing sitemap.xml');
  else {
    try {
      const sitemap = new JSDOM(sitemapText, { contentType: 'application/xml' }).window.document;
      if (sitemap.documentElement.localName !== 'urlset' || sitemap.documentElement.namespaceURI !== 'http://www.sitemaps.org/schemas/sitemap/0.9') fail('Invalid sitemap root/namespace');
      sitemapURLs = [...sitemap.querySelectorAll('url > loc')].map(node => node.textContent.trim());
      if (new Set(sitemapURLs).size !== sitemapURLs.length) fail('Duplicate sitemap URLs');
    } catch { fail('Invalid sitemap XML'); }
  }
  const expectedURLs = PUBLIC_PAGES.filter(page => page.indexable !== false).map(page => SITE_ORIGIN + (page.canonical || '/' + page.file));
  for (const url of expectedURLs) if (!sitemapURLs.includes(url)) fail('Missing sitemap URL ' + url);
  for (const url of sitemapURLs) if (!expectedURLs.includes(url)) fail('Unexpected sitemap URL ' + url);

  for (const page of PUBLIC_PAGES) {
    const file = path.join(root, page.file);
    const html = read(file);
    if (html === null) { fail('Missing public page ' + page.file); continue; }
    const url = new URL(page.canonical || '/' + page.file, SITE_ORIGIN);
    const document = documentFor(file);
    // DOM parsers repair duplicate html/head/body tags; inspect raw structure as well.
    const markup = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    for (const tag of ['html', 'head', 'body']) {
      if ((markup.match(new RegExp('<' + tag + '\\b', 'gi')) || []).length !== 1) fail(url.pathname + ': expected one ' + tag + ' element');
    }
    for (const selector of ['title', 'link[rel="canonical"]', 'meta[name="description"]', 'h1', 'main', 'body > header.header', 'body > footer.footer']) {
      if (document.querySelectorAll(selector).length !== 1) fail(url.pathname + ': expected one ' + selector);
    }
    if (document.querySelector('link[rel="canonical"]')?.getAttribute('href') !== url.href) fail('Incorrect canonical: ' + url.pathname);
    if (!document.title.trim() || !document.querySelector('meta[name="description"]')?.content.trim()) fail('Missing metadata: ' + url.pathname);
    const noindex = [...document.querySelectorAll('meta[name="robots"], meta[name="googlebot"]')].some(meta => /\bnoindex\b/i.test(meta.content));
    if (noindex !== (page.indexable === false)) fail(url.pathname + ': incorrect indexing policy');
    const ids = new Set();
    for (const element of document.querySelectorAll('[id]')) {
      if (!element.id || /\s/.test(element.id)) fail(url.pathname + ': invalid ID ' + JSON.stringify(element.id));
      if (ids.has(element.id)) fail(url.pathname + ': duplicate ID ' + element.id);
      ids.add(element.id);
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { JSON.parse(script.textContent); structured++; } catch { fail('Invalid JSON-LD: ' + url.pathname); }
    }
    checkAssets(document, url);
  }

  const robots = read(path.join(root, 'robots.txt')) || '';
  if (!robots.includes('Sitemap: ' + SITE_ORIGIN + '/sitemap.xml')) fail('robots.txt is missing the canonical sitemap');
  if (/^Disallow:\s*\/crm(?:\/|\$|\s*$)/mi.test(robots)) fail('robots.txt prevents crawlers reading CRM noindex');
  for (const name of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'robots.txt', '.htaccess']) {
    if (!exists(path.join(root, name))) fail('Missing ' + name);
  }
  if (!publicOnly) {
    const file = path.join(root, 'crm/index.html');
    if (!exists(file)) fail('Missing crm/index.html');
    else {
      const document = documentFor(file);
      if (![...document.querySelectorAll('meta[name="robots"]')].some(meta => /\bnoindex\b/i.test(meta.content))) fail('CRM must be noindex.');
      checkAssets(document, new URL('/crm/index.html', SITE_ORIGIN));
    }
    const assets = path.join(root, 'crm/assets');
    if (!fs.existsSync(assets)) fail('Missing crm/assets');
    else for (const name of fs.readdirSync(assets).filter(name => name.endsWith('.js'))) {
      if (/demo-hsst|127\.0\.0\.1:9099/.test(read(path.join(assets, name)) || '')) fail('Emulator configuration in production CRM: ' + name);
    }
  }
  return { pages: PUBLIC_PAGES.length, sitemapPages: sitemapURLs.length, references, structuredDataBlocks: structured, failures: [...new Set(failures)] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditRelease('dist', { publicOnly: process.argv.includes('--public-only') });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.failures.length ? 1 : 0;
}
