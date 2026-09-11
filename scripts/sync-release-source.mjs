// One-time, allowlisted consolidation. Original CRM checkout and Git history stay untouched.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const source = process.cwd(), target = path.resolve(process.argv[2] || '');
if (!process.argv[2] || target === source || target.startsWith(source + path.sep) || !fs.existsSync(path.join(target, '.git'))) throw new Error('Provide the separate, clean release Git worktree');
const gitFiles = (directory, args) => execFileSync('git', ['-C', directory, 'ls-files', '-z', ...args], { encoding: 'utf8' }).split('\0').filter(Boolean);
const allowed = name => !/(^|\/)(\.git|node_modules|dist|\.firebase|\.playwright-mcp|test-results|playwright-report)(\/|$)/.test(name) && !/(^|\/)\.env(\.|$)/.test(name) && !/(\.DS_Store|\.log|\.png$.*screenshot)/.test(name);
const rootAdditions = /^(\.node-version|\.github\/workflows\/|public\/|scripts\/|tests\/|src\/|css\/|js\/main-public\.js$|images\/|favicon\.ico$|apple-touch-icon\.png$|portfolio\.html$|virtual-assistance\.html$|links\.html$|firebase\.test\.json$|vitest\.rules\.config\.js$|tailwind\.config\.js$|tailwind\.marcelo\.js$|DESIGN_SYSTEM\.md$|\.impeccable\.md$|notes\/hostinger-deployment-runbook\.md$|notes\/2026-09-11-release\.md$)/;
const copied = [];
function copy(name, fromRoot = source, prefix = '') {
  if (!allowed(name) && !name.endsWith('.env.example')) return;
  const from = path.join(fromRoot, name), relative = prefix + name, to = path.join(target, relative);
  if (!fs.existsSync(from)) { if (fs.existsSync(to)) fs.unlinkSync(to); return; }
  if (!fs.lstatSync(from).isFile()) throw new Error(`Not a regular source file: ${name}`);
  fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); copied.push(relative);
}
for (const name of gitFiles(source, [])) copy(name);
for (const name of gitFiles(source, ['--others', '--exclude-standard'])) if (rootAdditions.test(name)) copy(name);
const crm = path.join(source, 'HSP CRM');
const activeCRM = /^(src\/|functions\/|firebase-public\/|firebase\.json$|firestore\.(rules|indexes\.json)$|\.firebaserc$|\.gitignore$|\.env\.example$|README\.md$|index\.html$|package(-lock)?\.json$|postcss\.config\.js$|tailwind\.config\.js$|vite\.config\.js$)/;
for (const name of new Set([...gitFiles(crm, []), ...gitFiles(crm, ['--others', '--exclude-standard'])])) if (activeCRM.test(name)) copy(name, crm, 'HSP CRM/');
console.log(`Copied ${copied.length} allowlisted source files. Original working trees and CRM history retained.`);
