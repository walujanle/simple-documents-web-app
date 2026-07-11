/**
 * Fails if automatic Astro link prefetch is re-enabled.
 * See AGENTS.md — LOCK: automatic link prefetch is forbidden.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const configPath = join(root, 'astro.config.mjs');
const config = readFileSync(configPath, 'utf8');

const errors = [];

if (!/prefetch\s*:\s*false\b/.test(config)) {
  errors.push('astro.config.mjs must contain `prefetch: false` (see AGENTS.md).');
}

if (/prefetch\s*:\s*true\b/.test(config)) {
  errors.push('astro.config.mjs must not set `prefetch: true`.');
}

if (/prefetchAll\s*:\s*true/.test(config)) {
  errors.push('astro.config.mjs must not set prefetchAll: true.');
}

const forbidden = [
  /prefetchAll\s*:\s*true/,
  /data-astro-prefetch/,
  /from\s+['"]astro:prefetch['"]/,
  /init\s*\(\s*\{\s*prefetchAll\s*:\s*true/,
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === '.astro')
      continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(astro|ts|tsx|js|mjs|md)$/.test(name)) out.push(p);
  }
  return out;
}

for (const file of walk(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const re of forbidden) {
    if (re.test(text)) {
      errors.push(`${file}: forbidden pattern ${re}`);
    }
  }
}

if (errors.length) {
  console.error('check:no-prefetch FAILED\n');
  for (const e of errors) console.error(`- ${e}`);
  console.error('\nSee AGENTS.md. Do not re-enable automatic link prefetch.');
  process.exit(1);
}

console.log('check:no-prefetch OK (prefetch: false locked)');
