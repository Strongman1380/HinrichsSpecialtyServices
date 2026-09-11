import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const adSenseScript =
  '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7946657496151275" crossorigin="anonymous"></script>';

describe('AdSense site verification', () => {
  it('adds the AdSense loader to every generated HTML page', () => {
    execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });

    for (const page of ['index.html', 'contact.html', 'blog.html', 'virtual-assistance.html']) {
      const html = readFileSync(resolve('dist', page), 'utf8');
      expect(html).toContain(adSenseScript);
    }
  }, 60_000);
});
