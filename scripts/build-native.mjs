import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

mkdirSync('public', { recursive: true });
const compiler = process.env.CXX || 'clang++';
const rawOutput = 'public/rift-core.wasm';
const args = [
  '--target=wasm32', '-O3', '-nostdlib', '-fno-exceptions', '-fno-rtti', '-Inative/include',
  'native/src/terrain.cpp',
  '-Wl,--no-entry', '-Wl,--export-all', '-Wl,--export-memory',
  '-Wl,--initial-memory=33554432', '-Wl,--max-memory=67108864', '-Wl,--strip-all',
  '-o', rawOutput
];

const result = spawnSync(compiler, args, { stdio: 'inherit' });
if (result.error) {
  console.error(`Could not run ${compiler}. Install LLVM/Clang or set CXX to a wasm32-capable clang++.`);
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);

const wasm = readFileSync(rawOutput);
writeFileSync('public/rift-core.wasm.gz', gzipSync(wasm, { level: 9 }));
unlinkSync(rawOutput);

const nativeExtensions = /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/i;
function collectNativeFiles(dir, result = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) collectNativeFiles(full, result);
    else if (nativeExtensions.test(name)) result.push(full.replaceAll('\\', '/'));
  }
  return result;
}
function gitBlobSha(filePath) {
  const bytes = readFileSync(filePath);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const sources = collectNativeFiles('native').sort().map(filePath => ({
  path: filePath,
  gitBlobSha: gitBlobSha(filePath)
}));
writeFileSync('public/rift-core.sources.json', JSON.stringify({
  format: 'rift-core-sources-v1',
  abi: 1,
  sources
}, null, 2) + '\n');

console.log(`Built public/rift-core.wasm.gz (${wasm.length} raw bytes) from ${sources.length} native source/header file(s).`);
