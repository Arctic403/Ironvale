import fs from 'node:fs';

function replace(path, before, after, label) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(after)) return false;
  if (!source.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
  return true;
}

replace(
  'public/rift-diagnostic-hooks.js',
  "/(?:token|secret|password|auth|session|key)/i.test(key)",
  "/(?:token|ticket|secret|password|auth|session|key)/i.test(key)",
  'diagnostic hook URL redaction regex'
);

replace(
  'public/rift-diagnostics.js',
  "(?:access|refresh|auth|id)[-_]?token|token|(?:api|private|client)[-_]?secret",
  "(?:access|refresh|auth|id)[-_]?token|token|ticket|(?:api|private|client)[-_]?secret",
  'diagnostics REDACTED_KEY ticket coverage'
);

replace(
  'public/rift-diagnostics.js',
  "(?:access|refresh|auth|id)[-_]?token|token|(?:api|private|client)[-_]?secret|secret|cookie|authorization",
  "(?:access|refresh|auth|id)[-_]?token|token|ticket|(?:api|private|client)[-_]?secret|secret|cookie|authorization",
  'diagnostics string ticket coverage'
);

console.log('Ironvale integrity ticket redaction applied.');
