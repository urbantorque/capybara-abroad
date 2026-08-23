// Coordinator build step: concatenate the five locked modules + shared + main into a
// single self-contained HTML file that runs straight from file:// with no server.
//
//   node build.mjs
//
// Relies on the contract rules: imports only at the top in fixed forms, exports only
// via `export function`, every other top-level name module-prefixed.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Dependency order matters: shared first, main last.
const ORDER = [
  'src/shared.js',
  'src/environment.js',
  'src/pasto.js',
  'src/quay.js',
  'src/kyoto.js',
  'src/cali.js',
  'src/rio.js',
  'src/iceland.js',
  'src/sahara.js',
  'src/drift.js',
  'src/venice.js',
  'src/kowloon.js',
  'src/palawan.js',
  'src/goreme.js',
  'src/manly.js',
  'src/pantanal.js',
  'src/cave.js',
  'src/antarctic.js',
  'src/props.js',
  'src/capybara.js',
  'src/condor.js',
  'src/npc.js',
  'src/systems.js',
  'src/main.js',
];

const IMPORT_RE = /^[ \t]*import[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*\r?\n/gm;
const BARE_IMPORT_RE = /^[ \t]*import\s*['"][^'"]+['"];?[ \t]*\r?\n/gm;
const EXPORT_RE = /^[ \t]*export\s+(?=(?:async\s+)?function|const|let|var|class)/gm;

const problems = [];

function strip(file, src) {
  const imports = src.match(IMPORT_RE) || [];
  for (const line of imports) {
    const m = line.match(/from\s*['"]([^'"]+)['"]/);
    const spec = m && m[1];
    if (spec !== 'three' && spec !== 'cannon-es' && !/^\.\/[a-z]+\.js$/.test(spec)) {
      problems.push(`${file}: illegal import specifier "${spec}"`);
    }
  }
  if (/^[ \t]*export\s+default/m.test(src)) problems.push(`${file}: uses export default (contract violation)`);
  if (/\bimport\s*\(/.test(src)) problems.push(`${file}: uses dynamic import()`);
  if (/\bfetch\s*\(/.test(src)) problems.push(`${file}: uses fetch()`);

  let out = src.replace(IMPORT_RE, '').replace(BARE_IMPORT_RE, '').replace(EXPORT_RE, '');
  return out.trim();
}

const bodies = ORDER.map(f => {
  const src = readFileSync(join(ROOT, f), 'utf8');
  return `\n/* ======================= ${f} ======================= */\n` + strip(f, src) + '\n';
});

// Collision check: two modules declaring the same top-level function name would silently
// clobber each other once concatenated. Fail loudly instead.
const DECL_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const seen = new Map();
ORDER.forEach((f, i) => {
  let m;
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(bodies[i]))) {
    const name = m[1] || m[2];
    if (seen.has(name)) problems.push(`NAME COLLISION: "${name}" declared in both ${seen.get(name)} and ${f}`);
    else seen.set(name, f);
  }
});

if (problems.length) {
  console.error('\n  BUILD BLOCKED — contract violations:\n');
  for (const p of problems) console.error('   * ' + p);
  console.error('');
  process.exit(1);
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const bundled = html.replace(
  '<script type="module" src="./src/main.js"></script>',
  '<script type="module">\n' +
  "import * as THREE from 'three';\n" +
  "import * as CANNON from 'cannon-es';\n" +
  bodies.join('\n') +
  '\n</script>'
);

mkdirSync(join(ROOT, 'dist'), { recursive: true });
const outPath = join(ROOT, 'dist', 'untitled-capybara-game.html');
writeFileSync(outPath, bundled, 'utf8');

const kb = (Buffer.byteLength(bundled, 'utf8') / 1024).toFixed(1);
console.log(`OK  ${outPath}  (${kb} KB, ${seen.size} top-level declarations, no collisions)`);
