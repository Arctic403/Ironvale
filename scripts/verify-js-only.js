import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', '.wrangler', 'dist', 'build', '.cache']);
const forbiddenExtensions = new Set(['.ts', '.tsx', '.mts', '.cts']);
const forbiddenConfigNames = new Set(['tsconfig.json', 'tsconfig.base.json', 'jsconfig.ts']);
const violations = [];

async function scanDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const fullPath = join(directory, entry.name);
    const repoPath = relative(root, fullPath).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      await scanDirectory(fullPath);
      continue;
    }

    if (forbiddenExtensions.has(extname(entry.name)) || entry.name.endsWith('.d.ts') || forbiddenConfigNames.has(entry.name)) {
      violations.push(repoPath);
    }
  }
}

await scanDirectory(root);

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const dependencyGroups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
for (const group of dependencyGroups) {
  const dependencies = packageJson[group] || {};
  for (const name of Object.keys(dependencies)) {
    if (name === 'typescript' || name === 'ts-node' || name === 'tsx' || name.startsWith('@types/')) {
      violations.push(`package.json -> ${group}.${name}`);
    }
  }
}

if (violations.length) {
  console.error('TypeScript-related files or dependencies found:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('JS-only check passed: no TypeScript source, config, declarations, or TypeScript dependencies found.');
