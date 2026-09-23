// Replays Rio's six-place fuzz prefix without changing the release probe.
// The same 45-second key stream and browser runtime still lead into Rio.
import { readFileSync } from 'node:fs';
import { openHarness } from './reimagine-harness.mjs';

let source = readFileSync(new URL('./fuzz.js', import.meta.url), 'utf8');
source = source.replace('const sysFUZZ_SEC = 8;', 'const sysFUZZ_SEC = 45;');
source = source.replace(/const names = \['sydney',[\s\S]*?'hanoi'\];/,
  "const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio'];");
if (!source.includes("const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio'];") ||
    source.includes('const sysFUZZ_SEC = 8;')) throw new Error('Fuzz staging did not match source');
const probe = new Function('return (' + source + '\n);')();
const harness = await openHarness({ url: 'http://localhost:5188/', pinRung: false });
try {
  await probe(harness.page);
} finally {
  await harness.close();
}
