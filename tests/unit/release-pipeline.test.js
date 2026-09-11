// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import sharp from 'sharp';
import { makeManifest, safePath, validateManifest } from '../../scripts/release-artifact.mjs';
import { publishFiles, backupRemote, webrootClient, equivalentImage } from '../../scripts/hostinger-release.mjs';

const temporary = [];
async function artifact(version) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hsst-release-test-')); temporary.push(root);
  await fs.mkdir(path.join(root, 'crm'));
  await fs.mkdir(path.join(root, 'assets'));
  for (const name of ['index.html', 'portfolio.html', 'crm/index.html', '.htaccess', `assets/${version}.css`]) await fs.writeFile(path.join(root, name), `${version}:${name}`);
  await makeManifest(root, { releaseId: version });
  return root;
}
class MemoryFTP {
  files = new Map(); renames = []; uploads = 0; failUpload = Infinity; failRename = Infinity;
  async ensureDir() {} async cd() {}
  async uploadFrom(local, remote) { if (++this.uploads === this.failUpload) throw Error('Rehearsed transfer failure'); this.files.set(remote, await fs.readFile(local)); }
  async downloadTo(output, remote) { const bytes = this.files.get(remote); if (!bytes) throw Error(`Missing ${remote}`); if (typeof output === 'string') await fs.writeFile(output, bytes); else { output.write(bytes); output.end(); } }
  async rename(from, to) { if (this.renames.length === this.failRename) { this.failRename = Infinity; throw Error('Rehearsed rename failure'); } this.renames.push(to); this.files.set(to, this.files.get(from)); this.files.delete(from); }
  async sendIgnoringError(command) { return { code: this.files.has(command.slice(5)) ? 213 : 550 }; }
  async remove(remote) { this.files.delete(remote); }
  async list(prefix) {
    const base = prefix.endsWith('/') ? prefix : `${prefix}/`, rows = new Map();
    for (const key of this.files.keys()) { if (!key.startsWith(base)) continue; const rest = key.slice(base.length), name = rest.split('/')[0]; rows.set(name, { name, isFile: !rest.includes('/'), isDirectory: rest.includes('/'), isSymbolicLink: false }); }
    return [...rows.values()];
  }
}
afterEach(async () => { for (const root of temporary.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
describe('recoverable Hostinger releases', () => {
  it('accepts image recompression but rejects different content or dimensions', async () => {
    const image = color => sharp({ create: { width: 180, height: 180, channels: 4, background: color } }).png().toBuffer();
    const original = await image('#123456'), compressed = await sharp(original).png({ palette: true }).toBuffer();
    expect(await equivalentImage(original, compressed)).toBe(true);
    expect(await equivalentImage(original, await image('#ff0000'))).toBe(false);
    expect(await equivalentImage(original, await sharp(original).resize(90).png().toBuffer())).toBe(false);
    const pixels = Buffer.alloc(256 * 256 * 3);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pixels.fill((x + y) % 2 ? 255 : 0, (y * 256 + x) * 3, (y * 256 + x + 1) * 3);
    const checkerboard = await sharp(pixels, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
    const gray = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#808080' } }).png().toBuffer();
    expect(await equivalentImage(checkerboard, gray)).toBe(false);
  });
  it('scopes every uploaded file and rename to the actual public_html destination', async () => {
    const raw = new MemoryFTP(), root = await artifact('scoped');
    raw.files.set('/index.html', Buffer.from('unrelated older copy'));
    await publishFiles(webrootClient(raw), root, { verify: false });
    expect(raw.files.get('/index.html').toString()).toBe('unrelated older copy');
    expect(raw.files.get('/public_html/index.html').toString()).toBe('scoped:index.html');
    expect(raw.renames.every(name => name.startsWith('/public_html/'))).toBe(true);
    expect(() => webrootClient(raw).cd('/../outside')).toThrow();
  });
  it('rejects traversal and any altered artifact before transfer', async () => {
    for (const name of ['../secret', '/index.html', 'a/../b', 'a\\b', 'a\nb']) expect(() => safePath(name)).toThrow();
    const root = await artifact('new'); await fs.writeFile(path.join(root, 'index.html'), 'corrupted');
    await expect(validateManifest(root)).rejects.toThrow('hash mismatch');
  });
  it('does not publish any entry document when an upload fails', async () => {
    const ftp = new MemoryFTP(), root = await artifact('next'); ftp.files.set('/index.html', Buffer.from('previous')); ftp.failUpload = 3;
    await expect(publishFiles(ftp, root, { verify: false })).rejects.toThrow('transfer failure');
    expect(ftp.files.get('/index.html').toString()).toBe('previous'); expect(ftp.renames).toEqual([]);
  });
  it('publishes assets before HTML, preserves old assets, and restores a full snapshot after a partial rename failure', async () => {
    const ftp = new MemoryFTP(), before = await artifact('before'), next = await artifact('next');
    await publishFiles(ftp, before, { verify: false });
    const backup = await fs.mkdtemp(path.join(os.tmpdir(), 'hsst-release-test-')); temporary.push(backup);
    await backupRemote(ftp, backup);
    ftp.failRename = ftp.renames.length + 3;
    await expect(publishFiles(ftp, next, { verify: false })).rejects.toThrow('rename failure');
    const introduced = ['new.html', 'js/new.js', 'nested/.htaccess', 'new.html.gz', 'missing.html'];
    for (const name of introduced.slice(0, -1)) ftp.files.set('/' + name, Buffer.from('new behavior'));
    await publishFiles(ftp, backup, { introduced });
    for (const name of introduced) expect(ftp.files.has('/' + name)).toBe(false);
    for (const name of introduced.slice(0, -1)) expect([...ftp.files.keys()].some(key => key.startsWith('/.hsst-quarantine-') && key.endsWith('/' + name))).toBe(true);
    for (const name of ['index.html', 'portfolio.html', 'crm/index.html', '.htaccess']) expect(ftp.files.get(`/${name}`).toString()).toBe(`before:${name}`);
    expect(ftp.files.has('/assets/before.css')).toBe(true);
    expect(ftp.renames.indexOf('/assets/before.css')).toBeLessThan(ftp.renames.indexOf('/index.html'));
    expect((await validateManifest(backup)).backup).toBe(true);
  });
});
