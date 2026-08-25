// THE FOUR CHANNELS, AUDITED STATICALLY — batch 3, 26 Aug 2026.
//
// CONTRACT.md §THE FOUR CHANNELS names four ways a moment can say "that
// landed": framed, lit, audible, acknowledged. Marquee moments in this project
// fail SILENTLY and have done so in every previous pass, which is exactly why
// they need an audit that runs without a browser: three of the four channels
// are visible in the source, and the one that is not (audible, at the moment
// itself) is the one a screenshot cannot judge either.
//
// This audit asserts, per chapter:
//   1. EXACTLY ONE `wow` row. The doctrine in shared.js says one; nothing
//      checked it, and two rows halve what the first is worth.
//   2. A ROW IN THE EVENT GRADE LAYER — "lit". Absent in a chapter means
//      nothing that happens there can change bloom, threshold or vignette.
//   3. A `frameShot(` CALL SOMEWHERE IN THE CHAPTER'S FILE — "framed", which
//      before v26 was not a channel any biome could opt into at all.
//   4. EVERY `addCritter` NAMES `bold`. v25: the registry defaults it to 0, so
//      a registration without it is not a shy animal, it is a DEAD one — the
//      whole calm inversion is silently absent. Found in quay.js by hand.
//
// Run: node qa/channels.mjs        (exit 1 on any failure)
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// chapter number -> [biome key, source file]. CHAPTERS is the only table, but
// it lives inside a module that imports three.js, so this mirror is spelled out
// and asserted against shared.js's own chapter numbers below.
const CH = {
  1:  ['sydney',   'src/environment.js'],
  2:  ['pasto',    'src/pasto.js'],
  3:  ['quay',     'src/quay.js'],
  4:  ['kyoto',    'src/kyoto.js'],
  5:  ['cali',     'src/cali.js'],
  6:  ['rio',      'src/rio.js'],
  7:  ['iceland',  'src/iceland.js'],
  8:  ['sahara',   'src/sahara.js'],
  9:  ['drift',    'src/drift.js'],
  10: ['venice',   'src/venice.js'],
  11: ['kowloon',  'src/kowloon.js'],
  12: ['palawan',  'src/palawan.js'],
  13: ['goreme',   'src/goreme.js'],
  14: ['manly',    'src/manly.js'],
  15: ['pantanal', 'src/pantanal.js'],
  16: ['cave',     'src/cave.js'],
  17: ['antarctic','src/antarctic.js'],
};

// A chapter's short weight in the grade layer is an abbreviation — sahT, gorT,
// caliT, iceT — so the test is "a `<something>T` token whose stem is a prefix of
// this chapter's key". Written by TOKENISING and not with a `\b` regex on
// purpose: v24 lost a day to `qa/verbs.mjs`, where the heredoc that wrote the
// file ate one backslash of each pair, `\b` became a literal backspace, and the
// audit passed clean against the exact clue it existed to catch.
function gradeHasWeight(grade, key) {
  const stem = key.slice(0, 3);
  for (const tok of grade.match(/[A-Za-z][A-Za-z0-9]*/g) || []) {
    if (tok.length > 1 && tok[tok.length - 1] === 'T' && tok.slice(0, 3) === stem) return true;
  }
  return false;
}

const fails = [], warns = [];
const shared = read('src/shared.js');
const systems = read('src/systems.js');

// ---- 1. one wow row per chapter -------------------------------------------
const wowBy = {};
for (const m of shared.matchAll(/\{[^{}]*?\bid:\s*'([^']+)'[\s\S]{0,400}?\bwow:\s*'/g)) {
  // the row's chapter number is inside the same brace group
  const seg = m[0];
  const c = /chapter:\s*(\d+)/.exec(seg);
  if (c) (wowBy[+c[1]] ||= []).push(m[1]);
}
for (const n of Object.keys(CH).map(Number)) {
  const got = wowBy[n] || [];
  if (got.length === 0) fails.push(`ch ${n} ${CH[n][0]}: NO wow row — the chapter has no moment it is for`);
  else if (got.length > 1) fails.push(`ch ${n} ${CH[n][0]}: ${got.length} wow rows (${got.join(', ')}) — one per chapter`);
}

// ---- 2. lit: a row in the event grade layer --------------------------------
// The layer is the block that builds the post chain's bloom/threshold/vignette
// each frame. Bounded by its own two landmarks so a re-order does not silently
// widen it to the whole file.
const gStart = systems.indexOf('let bloom = cur.bloom, thr = cur.threshold');
const gEnd = systems.indexOf('pp.bloom = bloom < 0 ? 0 : bloom;');
if (gStart < 0 || gEnd < 0 || gEnd <= gStart) {
  fails.push('could not find the event grade layer in systems.js — this audit has gone stale');
} else {
  const grade = systems.slice(gStart, gEnd);
  for (const n of Object.keys(CH).map(Number)) {
    const key = CH[n][0];
    // A chapter has a row if the block names it: by isActive, by game.<key>, or
    // by its own short weight. The short weight is spelled out per chapter
    // because they are abbreviations (sahT, gorT, caliT...) and a regex over
    // "<3 letters>T" would match half the file.
    const named = grade.includes(`isActive('${key}')`) || grade.includes(`game.${key}`) ||
                  gradeHasWeight(grade, key);
    if (!named) warns.push(`ch ${n} ${key}: NO row in the event grade layer — "lit" is not a channel this chapter has`);
  }
}

// ---- 3. framed: the chapter can ask for its own bearing --------------------
for (const n of Object.keys(CH).map(Number)) {
  const [key, file] = CH[n];
  let src = '';
  try { src = read(file); } catch { fails.push(`ch ${n} ${key}: ${file} is missing`); continue; }
  if (!/\bframeShot\s*\(/.test(src))
    warns.push(`ch ${n} ${key}: ${file} never calls game.frameShot — its marquee is shown from wherever the player stood`);
}

// ---- 4. every addCritter names bold ---------------------------------------
// A GREEN RESULT HERE MUST BE SHOWN TO MEAN SOMETHING. The count of calls
// actually examined is printed, because "no bare addCritter" and "this scan
// found no addCritter at all" are otherwise the same clean line — which is the
// mistake `qa/pf-mischief.js` was found making in this very batch.
let critCalls = 0, critChapters = 0;
// A call with no `bold` is a DEAD registration: appr never leaves zero and the
// v23 calm inversion is absent for that species. Read as a bug until proven
// deliberate. The scan takes the balanced object literal after the call.
for (const n of Object.keys(CH).map(Number)) {
  const [key, file] = CH[n];
  let src = '';
  try { src = read(file); } catch { continue; }
  const lines = src.split(/\r?\n/);
  let here = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/addCritter\s*\(/.test(lines[i])) continue;
    critCalls++; here++;
    // the call may wrap; take up to 14 lines or until the brace balance closes
    let seg = '', depth = 0, started = false;
    for (let j = i; j < Math.min(i + 14, lines.length); j++) {
      seg += lines[j] + '\n';
      for (const ch of lines[j]) {
        if (ch === '(') { depth++; started = true; }
        else if (ch === ')') depth--;
      }
      if (started && depth <= 0) break;
    }
    if (!/\bbold\s*:/.test(seg))
      fails.push(`ch ${n} ${key}: ${file}:${i + 1} addCritter with no \`bold\` — a dead registration, the calm inversion cannot reach it`);
  }
  if (here) critChapters++;
}

// ---- report ----------------------------------------------------------------
const pad = s => s;
console.log(`
critters: ${critCalls} addCritter calls examined in ${critChapters} of 17 chapters — the other ${17 - critChapters} register no animal, so batch 1's calm inversion has nothing to invert there.`);
if (warns.length) { console.log('\nWARN — a channel a chapter does not have:'); for (const w of warns) console.log('  ~ ' + pad(w)); }
if (fails.length) { console.log('\nFAIL:'); for (const f of fails) console.log('  x ' + pad(f)); }
if (!fails.length && !warns.length) console.log('\nchannels: all 17 chapters have one wow row, a grade row, a frameShot and no bare addCritter.');
const dirty = new Set([...fails, ...warns].map(s => (/^ch (\d+)/.exec(s) || [, '?'])[1]));
console.log(`\n${17 - dirty.size}/17 chapters carry all three source-visible channels · ${fails.length} fail · ${warns.length} warn`);
process.exit(fails.length ? 1 : 0);
