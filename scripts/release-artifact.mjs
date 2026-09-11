import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function safePath(name) {
  if (!name || name.startsWith('/') || /[\\\x00-\x1f]/.test(name) || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error(`Unsafe release path: ${name}`);
  return name;
}
export async function filesUnder(root, prefix = '') {
  const result = [];
  for (const item of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = safePath(prefix ? `${prefix}/${item.name}` : item.name);
    if (item.isSymbolicLink()) throw new Error(`Symlinks are not release files: ${name}`);
    if (item.isDirectory()) result.push(...await filesUnder(root, name));
    else if (item.isFile()) result.push(name);
  }
  return result.sort();
}
export async function makeManifest(root, metadata = {}) {
  const files = {};
  for (const name of await filesUnder(root)) {
    if (name === 'release-manifest.json') continue;
    const bytes = await fs.readFile(path.join(root, name));
    files[name] = { bytes: bytes.length, sha256: digest(bytes) };
  }
  const manifest = { schema: 1, ...metadata, files };
  await fs.writeFile(path.join(root, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
export async function validateManifest(root) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'release-manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || !manifest.files || typeof manifest.files !== 'object') throw new Error('Invalid release manifest');
  for (const [name, expected] of Object.entries(manifest.files)) {
    const bytes = await fs.readFile(path.join(root, safePath(name)));
    if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256) throw new Error(`Artifact hash mismatch: ${name}`);
  }
  if ((await filesUnder(root)).length !== Object.keys(manifest.files).length + 1) throw new Error('Unmanifested files in release');
  for (const name of ['index.html', 'portfolio.html', 'crm/index.html', '.htaccess']) if (!manifest.files[name]) throw new Error(`Incomplete release: ${name}`);
  return manifest;
}
export async function prepareArtifact(root) {
  // Sidecars must match the final combined build, including copied static files.
  for (const name of await filesUnder(root)) {
    if (!/\.(html|css|js|json|xml|svg|txt|webmanifest)$/.test(name) || name === 'release-manifest.json') continue;
    const bytes = await fs.readFile(path.join(root, name));
    await fs.writeFile(path.join(root, `${name}.gz`), gzipSync(bytes, { level: 9 }));
    await fs.writeFile(path.join(root, `${name}.br`), brotliCompressSync(bytes));
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const manifest = await makeManifest(root, { commit, releaseId: `${commit.slice(0, 12)}-${Date.now()}`, createdAt: new Date().toISOString() });
  await validateManifest(root);
  console.log(`Prepared ${manifest.releaseId}: ${Object.keys(manifest.files).length} hashed files`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prepareArtifact(path.resolve(process.argv[2] || 'dist'));
