// Build the BEFORE arm of the v41 differential, in place.
//
// `git stash push -- src/systems.js` is the usual way to get an A/B and it does
// not work here: the old build has no `game.music.bus`, so the probe has nothing
// to hang an analyser on and the whole run comes back "no bus". What this does
// instead is switch OFF the three v41 mix changes and leave everything else —
// including the probe hook — exactly where it is, which is a cleaner isolation
// than a stash anyway: it holds the reverb internals, the feel and the breath
// constant and moves only the width and the room.
//
//   node qa/v41-arm.mjs off    # v40's mix, v41's probe hook
//   node qa/v41-arm.mjs on     # put it back
//
// `on` must leave `git diff src/systems.js` byte-identical to before `off`.

import { readFileSync, writeFileSync } from 'node:fs';

const P = new URL('../src/systems.js', import.meta.url);
const mode = process.argv[2];
if (mode !== 'off' && mode !== 'on') {
  console.error('usage: node qa/v41-arm.mjs off|on');
  process.exit(2);
}
let s = readFileSync(P, 'utf8');

// [pattern when ON, pattern when OFF]
const SWAPS = [
  // 1. the ensemble: no taps, and no trim to pay for them
  ['    if (ac.createStereoPanner && ac.createDelay) {',
   '    if (0) {   /* QA ARM: ensemble off */'],
  ['const sysMUS_ENS_TRIM = 0.84;',
   'const sysMUS_ENS_TRIM = 1;   /* QA ARM */'],
  // 2. the beds go back to the mono buffer
  ['  function noiseWideSrc() { noiseBuild(); return noiseMake(acNoiseW); }',
   '  function noiseWideSrc() { noiseBuild(); return noiseMake(acNoise); } /* QA ARM */'],
  // 3. one room for all nineteen chapters, at the old 3.6 s / wet 0.95
  ['const sysMUS_ROOM_A   = 2.6;', 'const sysMUS_ROOM_A   = 3.6;   /* QA ARM */'],
  ['const sysMUS_ROOM_B   = 0.85;', 'const sysMUS_ROOM_B   = 0;   /* QA ARM */'],
  ['const sysMUS_WET_MIN  = 0.72;', 'const sysMUS_WET_MIN  = 0.95;   /* QA ARM */'],
];

const from = mode === 'off' ? 0 : 1;
const to = mode === 'off' ? 1 : 0;
let hit = 0;
for (const sw of SWAPS) {
  if (!s.includes(sw[from])) { console.error('MISS: ' + sw[from].trim().slice(0, 60)); continue; }
  s = s.replace(sw[from], sw[to]);
  hit++;
}
// The wet ceiling has to move too, and it is written with a long comment above
// it, so it is handled by value rather than by line.
const wetMax = mode === 'off'
  ? [/const sysMUS_WET_MAX  = 1\.10;/, 'const sysMUS_WET_MAX  = 0.95;   /* QA ARM */']
  : [/const sysMUS_WET_MAX  = 0\.95;   \/\* QA ARM \*\//, 'const sysMUS_WET_MAX  = 1.10;'];
if (wetMax[0].test(s)) { s = s.replace(wetMax[0], wetMax[1]); hit++; }
else console.error('MISS: sysMUS_WET_MAX');

writeFileSync(P, s);
console.log('arm ' + mode + ': ' + hit + '/7 swaps applied');
