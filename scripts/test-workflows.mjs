import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const command = `env PATH=${quote(`${dirname(process.execPath)}:${process.env.PATH}`)} VITE_USE_EMULATORS=true ${quote(process.execPath)} ./node_modules/@playwright/test/cli.js test --config tests/finance-playwright.config.js --workers=1`;
const result = spawnSync('firebase', ['emulators:exec', '--config', 'firebase.test.json', '--project', 'demo-hsst', '--only', 'auth,firestore', command], { stdio: 'inherit', env: { ...process.env, HSST_EMULATOR_PASSWORD: randomUUID() } });
process.exitCode = result.status ?? 1;
