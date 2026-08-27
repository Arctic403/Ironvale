import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', '.wrangler', 'dist', 'build', '.cache']);
const forbiddenExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.jsx']);
const forbiddenConfigNames = new Set(['tsconfig.json', 'tsconfig.base.json', 'jsconfig.ts']);
const forbiddenFrameworkPackages = new Set(['react', 'react-dom']);
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
      continue;
    }

    if (repoPath === 'public/react-ui.js' || repoPath.startsWith('client/react/')) {
      violations.push(repoPath);
      continue;
    }

    if (['.js', '.mjs'].includes(extname(entry.name))) {
      const source = await readFile(fullPath, 'utf8');
      if (/(?:from\s*['"]react(?:-dom)?(?:\/[^'"]*)?['"]|import\(\s*['"]react(?:-dom)?(?:\/[^'"]*)?['"]\s*\)|esm\.sh\/react(?:-dom)?@|unpkg\.com\/react(?:-dom)?@)/i.test(source)) {
        violations.push(`${repoPath} -> removed UI framework import`);
      }
      if (repoPath === 'public/views/block-world.js' && /block-editor-ui\.js/.test(source)) {
        violations.push(`${repoPath} -> shared gameplay runtime must not import the private Block Editor UI`);
      }
    }
  }
}

await scanDirectory(root);

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const dependencyGroups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
for (const group of dependencyGroups) {
  const dependencies = packageJson[group] || {};
  for (const name of Object.keys(dependencies)) {
    if (name === 'typescript' || name === 'ts-node' || name === 'tsx' || name.startsWith('@types/') || forbiddenFrameworkPackages.has(name)) {
      violations.push(`package.json -> ${group}.${name}`);
    }
  }
}

if (violations.length) {
  console.error('Non-pure-JavaScript source or forbidden framework dependencies found:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('Pure-JS check passed: no TypeScript/JSX source and no React framework dependencies found.');
