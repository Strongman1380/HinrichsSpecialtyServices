import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('counts one explicit page view and one delegated click when initialized repeatedly', async () => {
  vi.resetModules();
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-PUBLICTEST');
  window.dataLayer = [];
  sessionStorage.clear();
  document.head.innerHTML = '';
  const { initAnalytics } = await import('../../src/scripts/utils/analytics.js');
  initAnalytics();
  initAnalytics();
  const calls = window.dataLayer.map(args => [...args]);
  expect(calls.filter(args => args[0] === 'config')).toEqual([
    ['config', 'G-PUBLICTEST', { send_page_view: false, anonymize_ip: true }],
  ]);
  expect(calls.filter(args => args[0] === 'event' && args[1] === 'page_view')).toHaveLength(1);
  expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')).toHaveLength(1);
  expect(sessionStorage.getItem('pages_viewed')).toBe('1');
  const anchor = document.createElement('a');
  anchor.href = 'https://example.test/';
  anchor.textContent = 'Example';
  anchor.addEventListener('click', event => event.preventDefault());
  document.body.append(anchor);
  anchor.click();
  expect(window.dataLayer.filter(args => args[1] === 'outbound_link_click')).toHaveLength(1);
  anchor.remove();
});
