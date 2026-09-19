// qa/wow-person.mjs — ONE PERSON, STATICALLY (ROADMAP-WOW, Part C)
//
//   node qa/wow-person.mjs
//
// A text scan, in qa/l8-catalogue.mjs's discipline. The people standard is
// `npcPERSON` in src/npc.js — the one skeleton every crowd is built from —
// and the way a chapter drifts off it is by rolling its own figure from the
// merger, which is exactly what Marrakech and Rio did for a year. So: every
// file that builds an instanced crowd (a `...BuildPeople(` or `...AddPerson(`
// of its own) must import npcPERSON from './npc.js' and read its geometry
// through it (npcPERSON.geo / .standing / .head), and no crowd builder may
// put a SPHERE on a body — a sphere reads smaller than a box of the same
// width, and that was the whole finding.
//
// The roster's own numbers (the 0.32 head, the 1.34 neck, the 1.22 child
// ratio) are pinned too, because a standard that can be retuned in passing is
// not one; move them on purpose, with the instrument (qa/wow-people.js) run.

import { readFileSync, readdirSync } from 'node:fs';

function fail(msg) { console.log('FAIL  ' + msg); process.exitCode = 1; }
function pass(msg) { console.log('pass  ' + msg); }

const npc = readFileSync('src/npc.js', 'utf8');

// ---- the standard exists, once, exported ----------------------------------
const defs = npc.match(/^export const npcPERSON = \{/gm) || [];
if (defs.length === 1) pass('npcPERSON is exported from src/npc.js, once');
else fail('expected exactly one `export const npcPERSON = {` in src/npc.js, found ' + defs.length);

const PIN = [
  ['HEAD: 0.32', 'the 0.32 m skull'],
  ['HEAD_Y: 1.34', 'the neck at 1.34'],
  ['CHILD_HEAD: npcCHILD_HEAD', 'the child head ratio read from npcCHILD_HEAD'],
  ['npcCHILD_HEAD = 1.22', 'npcCHILD_HEAD is 1.22'],
  ['JITTER: [0.92, 1.09]', 'the 0.92..1.09 height jitter'],
];
for (const [needle, what] of PIN) {
  if (npc.includes(needle)) pass(what);
  else fail('npcPERSON: ' + what + ' — `' + needle + '` not found');
}

// ---- the roster reads the lists it exports, not copies of them ------------
const READS = ['npcMakeGeo(npcPERSON.torso)', 'npcMakeGeo(npcPERSON.head)', 'npcMakeGeo(npcPERSON.hairParts)',
               'npcMakeGeo(npcPERSON.eyes)', 'npcMakeGeo(npcPERSON.brow)'];
for (const r of READS) {
  if (npc.includes(r)) pass('roster: ' + r);
  else fail('roster: expected `' + r + '` in src/npc.js');
}

// ---- every crowd builder imports it and builds through it -----------------
const files = readdirSync('src').filter(f => f.endsWith('.js') && f !== 'npc.js');
let builders = 0;
for (const f of files) {
  const src = readFileSync('src/' + f, 'utf8');
  const isBuilder = /function \w+BuildPeople\s*\(/.test(src) || /function \w+AddPerson\s*\(/.test(src);
  if (!isBuilder) continue;
  builders++;
  const imports = /import \{[^}]*\bnpcPERSON\b[^}]*\} from '\.\/npc\.js'/.test(src);
  if (imports) pass(f + ': crowd builder imports npcPERSON');
  else fail(f + ': builds a crowd (BuildPeople/AddPerson) but does not import npcPERSON from ./npc.js');
  const reads = /npcPERSON\.(geo|standing|head)\b/.test(src);
  if (reads) pass(f + ': crowd geometry comes from npcPERSON');
  else fail(f + ': imports npcPERSON but never builds from it (no npcPERSON.geo/.standing/.head)');
  // the body of the builder must not put a sphere on anybody
  const bp = src.match(/function \w+BuildPeople\s*\([\s\S]*?\n\}/);
  if (bp && /\.sph\(/.test(bp[0])) fail(f + ': its BuildPeople still puts a sphere on a person');
  else pass(f + ': no sphere head in its BuildPeople');
}
if (builders >= 2) pass(builders + ' crowd builders checked (Marrakech, Rio)');
else fail('expected at least the two crowd builders (sahara.js, rio.js), found ' + builders);

if (!process.exitCode) console.log('\nwow-person: all checks passed');
else console.log('\nwow-person: FAILED');
