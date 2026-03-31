import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const assets = [
  {
    source: resolve('src/storage/schema.sql'),
    target: resolve('dist/storage/schema.sql'),
  },
];

for (const asset of assets) {
  await mkdir(dirname(asset.target), { recursive: true });
  await copyFile(asset.source, asset.target);
}

console.log('Copied runtime assets to dist/');
