// ROADMAP-PAGES: repeat the inherited fuzz, Monaco only, unchanged gates.
import { readFileSync } from 'node:fs';
import { openHarness } from './reimagine-harness.mjs';
const h = await openHarness({ pinRung: false });
try {
  let source = readFileSync(new URL('./fuzz.js', import.meta.url), 'utf8');
  source = source.replace('const sysFUZZ_SEC = 8;', 'const sysFUZZ_SEC = 45;')
    .replace(/const names = \[[\s\S]*?\];/, "const names = ['monaco'];")
    .replace('name=fuzz.json', 'name=release-monaco-fuzz.json');
  await new Function('return (' + source + ')')()(h.page);
  if (h.metadata.errors.length) throw new Error(JSON.stringify(h.metadata.errors));
  console.log('Monaco 45-second inherited fuzz passed');
} finally { await h.close(); }
