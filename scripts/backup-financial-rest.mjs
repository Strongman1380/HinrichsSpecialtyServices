// Read-only operator backup. Raw Firestore types are preserved for reviewed recovery.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
const directory = process.argv[2];
if (!directory || !path.isAbsolute(directory)) throw new Error('Provide a new absolute private backup directory');
await fs.mkdir(directory, { mode: 0o700 });
const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const base = 'https://firestore.googleapis.com/v1/projects/hsp-crm/databases/(default)/documents';
const records = [];
async function list(collection) {
  let next;
  const rows = [];
  do {
    const url = `${base}/${collection.split('/').map(encodeURIComponent).join('/')}?pageSize=300${next ? `&pageToken=${encodeURIComponent(next)}` : ''}`;
    const response = spawnSync('curl', ['--config', '-', '--silent', '--show-error', '--connect-timeout', '15', '--max-time', '60', url], { input: `header = "Authorization: Bearer ${token}"\n`, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (response.status) throw new Error(`Backup request failed for ${collection}`);
    const data = JSON.parse(response.stdout);
    if (data.error) throw new Error(`Backup denied for ${collection}: ${data.error.code}`);
    rows.push(...(data.documents || [])); next = data.nextPageToken;
  } while (next);
  records.push(...rows); return rows;
}
const contacts = await list('contacts');
for (const collection of ['payments', 'invoices', '_invoiceNumbers', '_counters', 'servicePlans', 'timeEntries', 'tasks', 'activity']) await list(collection);
for (const contact of contacts) {
  const id = contact.name.split('/').at(-1);
  for (const collection of ['payments', 'notes']) await list(`contacts/${id}/${collection}`);
}
await fs.writeFile(path.join(directory, 'firestore-records.json'), JSON.stringify({ project: 'hsp-crm', createdAt: new Date().toISOString(), encoding: 'firestore-rest', records }, null, 2), { mode: 0o600, flag: 'wx' });
console.log(`Backed up ${records.length} records privately. No production records changed.`);
