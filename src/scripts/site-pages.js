// The public release inventory owns page entries, navigation, footer links and sitemap URLs.
export const SITE_ORIGIN = 'https://www.hinrichsspecialtyservices.com';
export const ADMIN_LINK = { href: '/crm/login', label: 'Admin CRM' };
export const PUBLIC_PAGES = [
  { file: 'index.html', href: 'index.html', canonical: '/', label: 'Home', nav: true, footer: 'Explore', priority: '1.0' },
  { file: 'our-story.html', href: 'our-story.html', label: 'Our Story', nav: true, footer: 'Explore', priority: '0.80' },
  { file: 'digital-solutions.html', href: 'digital-solutions.html', label: 'Digital Solutions', nav: true, footer: 'Services', priority: '0.95' },
  { file: 'portfolio.html', href: 'portfolio.html', label: 'Portfolio', nav: true, footer: 'Services', priority: '0.85' },
  { file: 'virtual-assistance.html', href: 'virtual-assistance.html', label: 'Virtual Assistant', nav: true, footer: 'Services', priority: '0.85' },
  { file: 'contact.html', href: 'contact.html', label: 'Contact', nav: true, footer: 'Explore', priority: '0.85' },
  { file: 'links.html', href: 'links.html', label: 'Links', footer: 'Explore', priority: '0.40' },
  { file: 'terms.html', href: 'terms.html', label: 'Terms of Service', footer: 'Legal', priority: '0.20' },
  { file: 'privacy.html', href: 'privacy.html', label: 'Privacy Policy', footer: 'Legal', priority: '0.20' },
  { file: 'data-deletion.html', href: 'data-deletion.html', label: 'Data Deletion Policy', footer: 'Legal', priority: '0.20' },
  { file: 'success.html', href: 'success.html', label: 'Message Received', indexable: false },
];

export const publicPageInputs = Object.fromEntries(PUBLIC_PAGES.map(page => [
  page.file === 'index.html' ? 'main' : page.file.replace(/\.html$/, ''), `./${page.file}`,
]));

export function renderSitemap() {
  const urls = PUBLIC_PAGES.filter(page => page.indexable !== false).map(page => `  <url>
    <loc>${SITE_ORIGIN}${page.canonical || `/${page.file}`}</loc>
    <priority>${page.priority}</priority>
  </url>`);
  // Do not manufacture lastmod dates on every build.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
