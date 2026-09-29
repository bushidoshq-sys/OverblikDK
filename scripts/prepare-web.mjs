import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'www');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const entries = await readdir(root, { withFileTypes: true });

for (const entry of entries) {
  if (entry.name === 'www' || entry.name === 'android' || entry.name === 'node_modules' ||
      entry.name === '.git' || entry.name === '.github' || entry.name === 'scripts' ||
      entry.name === 'package.json' || entry.name === 'package-lock.json' ||
      entry.name === 'capacitor.config.json') continue;

  const src = path.join(root, entry.name);
  const dest = path.join(out, entry.name);

  if (entry.isDirectory()) {
    if (entry.name === 'assets' || entry.name === 'icons') {
      await cp(src, dest, { recursive: true });
    }
    continue;
  }

  if (/\.html$/i.test(entry.name) ||
      entry.name === 'manifest.json' ||
      entry.name === 'service-worker.js' ||
      entry.name === 'favicon.png') {
    await cp(src, dest);
  }
}

console.log('Prepared OverblikDK web bundle in www/');
