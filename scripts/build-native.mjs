import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

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
console.log(`Built public/rift-core.wasm.gz (${wasm.length} raw bytes).`);
