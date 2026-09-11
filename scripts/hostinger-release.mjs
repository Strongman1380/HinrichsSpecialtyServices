import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Readable, Writable } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { Client } from 'basic-ftp';
import { digest, safePath, makeManifest, validateManifest } from './release-artifact.mjs';

const exec = promisify(execFile);
const origin = 'https://www.hinrichsspecialtyservices.com';
export async function httpBytes(name, releaseId = '') {
  const url = `${origin}/${safePath(name).split('/').map(encodeURIComponent).join('/')}${releaseId ? `?hsstRelease=${encodeURIComponent(releaseId)}` : ''}`;
  const { stdout } = await exec('curl', ['--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--connect-timeout', '15', '--max-time', '60', url], { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}
export async function remoteHash(client, remote) {
  const hash = createHash('sha256');
  await client.downloadTo(new Writable({ write(chunk, encoding, next) { hash.update(chunk); next(); } }), remote);
  return hash.digest('hex');
}
export async function verifyLive(root) {
  const manifest = await validateManifest(root);
  const files = Object.entries(manifest.files).filter(([name]) => !name.split('/').some(p => p.startsWith('.')) && !/\.(gz|br)$/.test(name));
  let checked = 0;
  async function worker() {
    for (let item; (item = files.shift());) {
      const [name, expected] = item;
      if (digest(await httpBytes(name, manifest.releaseId)) !== expected.sha256) throw new Error(`LIVE HASH MISMATCH: ${name}`);
      checked++;
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  const live = JSON.parse((await httpBytes('release-manifest.json', manifest.releaseId)).toString());
  if (live.releaseId !== manifest.releaseId) throw new Error('Live release manifest does not match');
  for (const route of ['crm/login', 'crm/payments', 'crm/invoices', 'crm/clients/example']) {
    if (digest(await httpBytes(route, manifest.releaseId)) !== manifest.files['crm/index.html'].sha256) throw new Error(`CRM refresh route failed: ${route}`);
  }
  console.log(`Live verification passed: ${checked} exact file hashes and four CRM refresh routes.`);
}
export async function preflight(client, { recovery = false } = {}) {
  await client.cd('/');
  if (await client.pwd() !== '/') throw new Error('FTP account must be jailed to the site webroot');
  if (recovery) {
    if (process.env.HOSTINGER_FTP_USER !== 'u855082584.hinrichsspecialtyservices.com') throw new Error('Recovery requires the independently verified site-specific FTP account');
  } else {
    // Hostinger may transform HTML. Match a binary public asset instead of the
    // already-corrupted entry document before staging its replacement.
    if (process.env.HOSTINGER_FTP_USER !== 'u855082584.hinrichsspecialtyservices.com' || await remoteHash(client, '/favicon.ico') !== digest(await httpBytes('favicon.ico'))) throw new Error('FTP / does not match the public website. Refusing upload.');
  }
  const probe = `/.hsst-probe-${randomUUID()}`, renamed = `${probe}-renamed`, content = Buffer.from(randomUUID());
  let current;
  try {
    await client.uploadFrom(Readable.from(content), probe); current = probe;
    await client.rename(probe, renamed); current = renamed;
    if (await remoteHash(client, renamed) !== digest(content)) throw new Error('FTP rename/read-back failed');
  } finally { if (current && !client.closed) await client.remove(current); }
  console.log('Verified FTPS certificate, FTP / to public_html mapping, upload, rename, and read-back.');
}
export async function backupRemote(client, root) {
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  let count = 0;
  async function visit(prefix = '') {
    for (const item of await client.list(`/${prefix}`)) {
      if (['.', '..'].includes(item.name)) continue;
      if (item.name.startsWith('.hsst-stage-') || item.name.startsWith('.hsst-probe-')) continue;
      const name = safePath(prefix ? `${prefix}/${item.name}` : item.name);
      if (item.isSymbolicLink) throw new Error(`Cannot guarantee complete backup with remote symlink: ${name}`);
      const target = path.join(root, name);
      if (item.isDirectory) { await fs.mkdir(target, { recursive: true }); await visit(name); }
      else if (item.isFile) { await client.downloadTo(target, `/${name}`); count++; }
      else throw new Error(`Unknown remote file type: ${name}`);
    }
  }
  await visit();
  const former = path.join(root, 'release-manifest.json');
  try { await fs.rename(former, path.join(root, 'previous-release-manifest.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await makeManifest(root, { releaseId: `backup-${Date.now()}`, createdAt: new Date().toISOString(), backup: true });
  await validateManifest(root);
  console.log(`Complete backup: ${count} files at ${root}`);
}
export async function publishFiles(client, root, { verify = true, introduced = [] } = {}) {
  const manifest = await validateManifest(root);
  const stage = `/.hsst-stage-${randomUUID()}`;
  const names = [...Object.keys(manifest.files), 'release-manifest.json'];
  const entries = name => /\.html(?:\.(?:gz|br))?$/.test(name) || name === '.htaccess' || name === 'release-manifest.json';
  const ordered = [...names.filter(n => !entries(n)), ...names.filter(n => entries(n) && n !== 'release-manifest.json'), 'release-manifest.json'];
  const directories = new Set();
  const ensure = async remote => { const dir = path.posix.dirname(remote); if (!directories.has(dir)) { await client.ensureDir(dir); await client.cd('/'); directories.add(dir); } };
  for (const name of names) {
    await ensure(`${stage}/${name}`);
    await client.uploadFrom(path.join(root, name), `${stage}/${name}`);
    const expected = name === 'release-manifest.json' ? digest(await fs.readFile(path.join(root, name))) : manifest.files[name].sha256;
    if (await remoteHash(client, `${stage}/${name}`) !== expected) throw new Error(`Staged read-back mismatch: ${name}`);
  }
  console.log(`Staged and verified ${names.length} files. Publishing assets before documents.`);
  for (const name of ordered) { await ensure(`/${name}`); await client.rename(`${stage}/${name}`, `/${name}`); }
  if (manifest.backup && introduced.length) {
    const quarantine = `/.hsst-quarantine-${randomUUID()}`;
    for (const name of introduced) {
      safePath(name);
      if (manifest.files[name] || name === 'release-manifest.json') continue;
      const status = await client.sendIgnoringError(`SIZE /${name}`);
      if (status.code === 550) continue;
      if (status.code !== 213) throw new Error(`Cannot inspect introduced file: ${name}`);
      await ensure(`${quarantine}/${name}`);
      await client.rename(`/${name}`, `${quarantine}/${name}`);
    }
  }
  // Retain old assets. Remove only obsolete compression siblings of replaced files.
  for (const name of names.filter(n => !/\.(gz|br)$/.test(n))) {
    for (const suffix of ['.gz', '.br']) {
      if (manifest.files[name + suffix]) continue;
      const response = await client.sendIgnoringError(`SIZE /${name}${suffix}`);
      if (response.code === 213) await client.remove(`/${name}${suffix}`);
      else if (response.code !== 550) throw new Error(`Could not inspect stale sidecar: ${name}${suffix}`);
    }
  }
  if (verify && manifest.backup) {
    // Full snapshots also contain intentionally forbidden/retired HTTP paths.
    for (const [name, expected] of Object.entries(manifest.files)) if (await remoteHash(client, `/${name}`) !== expected.sha256) throw new Error(`Restored snapshot mismatch: ${name}`);
    console.log('Complete snapshot restored and verified over FTPS.');
  } else if (verify) await verifyLive(root);
  console.log(`Published ${manifest.releaseId}. Previous assets retained; no deleting mirror used.`);
}
async function main() {
  const mode = process.argv[2], root = path.resolve(process.argv[3] || 'dist');
  if (mode === '--verify') return verifyLive(root);
  if (!['--preflight', '--publish', '--rollback', '--backup'].includes(mode)) throw new Error('Use --preflight, --publish, --backup, --verify, or --rollback [artifact directory]');
  for (const key of ['HOSTINGER_FTP_HOST', 'HOSTINGER_FTP_USER', 'HOSTINGER_FTP_PASSWORD']) if (!process.env[key]) throw new Error(`Missing ${key}`);
  if (!/^[a-zA-Z0-9.-]+$/.test(process.env.HOSTINGER_FTP_HOST)) throw new Error('Invalid TLS hostname');
  const options = { host: process.env.HOSTINGER_FTP_CONNECT_IP || process.env.HOSTINGER_FTP_HOST, port: 21, user: process.env.HOSTINGER_FTP_USER, password: process.env.HOSTINGER_FTP_PASSWORD, secure: true, secureOptions: { servername: process.env.HOSTINGER_FTP_HOST, rejectUnauthorized: true, minVersion: 'TLSv1.2' } };
  const client = new Client(30000);
  const backup = path.resolve(process.env.HSST_BACKUP_DIR || path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'hsst-release-')), 'backup'));
  let backupComplete = false, publishing = false, outgoing;
  try {
    await client.access(options); await preflight(client, { recovery: mode === '--rollback' });
    if (mode === '--preflight') return;
    if (mode !== '--backup') outgoing = await validateManifest(root);
    if (process.env.HSST_PREPARED_BACKUP === 'true') {
      if (!(await validateManifest(backup)).backup) throw new Error('Prepared backup is not a complete snapshot');
      console.log(`Using previously persisted complete backup: ${backup}`);
    } else await backupRemote(client, backup);
    backupComplete = true;
    if (mode === '--backup') return;
    const current = await validateManifest(backup);
    publishing = true; await publishFiles(client, root, { introduced: mode === '--rollback' ? Object.keys(current.files).filter(name => !outgoing.files[name]) : [] });
  } catch (error) {
    console.error(`Release FAILED: ${error.message}`);
    if (publishing && backupComplete) {
      console.error(`Restoring complete pre-release snapshot from ${backup}`);
      try { await client.access(options); const previous = await validateManifest(backup); await publishFiles(client, backup, { introduced: Object.keys(outgoing.files).filter(name => !previous.files[name]) }); }
      catch (restoreError) { console.error(`ROLLBACK NEEDS ATTENTION: ${restoreError.message}. Backup retained: ${backup}`); }
    }
    throw error;
  } finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
