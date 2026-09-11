import fs from 'node:fs/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const [mode, input, output] = process.argv.slice(2);
const key = Buffer.from(process.env.HSST_BACKUP_KEY || '', 'base64');
if (key.length !== 32 || !input || !output || !['encrypt', 'decrypt'].includes(mode)) throw new Error('Valid mode, paths, and 32-byte backup key required');
const bytes = await fs.readFile(input);
let result;
if (mode === 'encrypt') {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  result = Buffer.concat([Buffer.from('HSST1'), nonce, cipher.getAuthTag(), encrypted]);
} else {
  if (bytes.subarray(0, 5).toString() !== 'HSST1') throw new Error('Invalid backup envelope');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(5, 17));
  decipher.setAuthTag(bytes.subarray(17, 33));
  result = Buffer.concat([decipher.update(bytes.subarray(33)), decipher.final()]);
}
await fs.writeFile(output, result, { mode: 0o600, flag: 'wx' });
console.log(`Backup ${mode} complete.`);
