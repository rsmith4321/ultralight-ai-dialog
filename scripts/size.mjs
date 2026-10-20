import { build } from 'esbuild';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import fs from 'node:fs';
const measure = bytes => ({ raw: bytes.length, gzip: gzipSync(bytes).length, brotli: brotliCompressSync(bytes).length });
const result = {};
for (const name of ['launcher', 'panel']) {
  const built = await build({ entryPoints: [`chat/${name}.mjs`], bundle: true, minify: true, write: false, format: 'esm', target: ['safari15'], legalComments: 'none' });
  result[name] = measure(built.outputFiles[0].contents);
}
result.vanillaTotal = Object.fromEntries(['raw','gzip','brotli'].map(key => [key, result.launcher[key] + result.panel[key]]));
result.optionalModalCss = measure(fs.readFileSync('chat/modal.css'));
result.version = JSON.parse(fs.readFileSync('package.json')).version;
if (result.launcher.gzip > 2048 || result.panel.gzip > 8192 || result.vanillaTotal.gzip > 10240) throw new Error('Dialog exceeds the documented lightweight budget');
console.log(JSON.stringify(result, null, 2));
