// qa/l8-catalogue.mjs — THE ANIMAL GETS BETTER: THE CATALOGUE, STATICALLY
//
//   node qa/l8-catalogue.mjs
//
// A text scan, not a parser — the same discipline as qa/xmodule.mjs's "unread
// const" rule, applied to sysUPGRADES: every id in the table, everyday or
// capstone, must be READ somewhere by the mods/dropCap writer, or it is
// content nobody can ever feel. And the roadmap's own arithmetic (the
// everyday six sum to 730, the three capstones add 1020) is exactly the kind
// of number that silently drifts the next time a price is retuned — this
// fails loudly instead.
//
// NOT CHECKED HERE: F5's six wear-effect rows (435) and the "everything
// total" of 2185 that includes them — F5 is wave 2's job (wear) and does not
// exist in this tree yet. This file checks only what THIS pass built: F3's
// nine and F6's three. A wave-2 agent extending this file to add F5's sum is
// exactly the kind of extension the roadmap's own "beside it, not instead of
// it" rule wants.

import { readFileSync } from 'node:fs';

const src = readFileSync('src/systems.js', 'utf8');

function fail(msg) { console.log('FAIL  ' + msg); process.exitCode = 1; }
function pass(msg) { console.log('pass  ' + msg); }

// ---- pull the sysUPGRADES literal out as text -----------------------------
const m = src.match(/const sysUPGRADES = \[([\s\S]*?)\n  \];/);
if (!m) { fail('sysUPGRADES not found in src/systems.js'); process.exit(1); }
const body = m[1];

// Split into one chunk per `{ id: '...'` entry.
const entries = [];
const idRe = /\{\s*id:\s*'([\w-]+)'/g;
let em, starts = [];
while ((em = idRe.exec(body))) starts.push({ id: em[1], at: em.index });
for (let i = 0; i < starts.length; i++) {
  const from = starts[i].at;
  const to = i + 1 < starts.length ? starts[i + 1].at : body.length;
  entries.push({ id: starts[i].id, text: body.slice(from, to) });
}
if (entries.length !== 9) fail('expected 9 sysUPGRADES rows (6 everyday + 3 capstone), found ' + entries.length);
else pass('9 sysUPGRADES rows found: ' + entries.map(e => e.id).join(', '));

let everydaySum = 0, capstoneSum = 0;
const ids = [];
for (const e of entries) {
  ids.push(e.id);
  const isCapstone = /capstone:\s*true/.test(e.text);
  const prices = [...e.text.matchAll(/price:\s*([\d.]+)/g)].map(x => parseFloat(x[1]));
  if (!prices.length) { fail(e.id + ': no price found'); continue; }
  const sum = prices.reduce((a, b) => a + b, 0);
  if (isCapstone) capstoneSum += sum; else everydaySum += sum;
}

if (everydaySum === 730) pass('everyday six sum to 730 (' + everydaySum + ')');
else fail('everyday six should sum to 730, got ' + everydaySum);

if (capstoneSum === 1020) pass('three capstones add 1020 (' + capstoneSum + ')');
else fail('three capstones should sum to 1020, got ' + capstoneSum);

// ---- every id is READ somewhere by the writer, not just declared ----------
// A weak but real check: an id declared once (the table row) and never
// mentioned again anywhere else in the file is exactly the "unread const"
// shape xmodule.mjs polices for identifiers — here applied to string ids,
// since `owned.indexOf('puff2')` etc. is how this catalogue is actually read.
for (const id of ids) {
  const needle = "'" + id + "'";
  const count = src.split(needle).length - 1;
  if (count >= 2) pass(id + ': referenced ' + count + ' times (table + at least one read)');
  else fail(id + ': referenced only ' + count + ' time(s) — never read by the mods/dropCap writer');
}

// ---- the two hard sites nothing may touch ----------------------------------
// capyJUMP_HOLD (the apex sustain) and capyHOP_VEL (the launch impulse) are
// the two constants that actually decide the 1.37 m apex; neither may ever
// appear multiplied by a mods field, in EITHER file. This is the static half
// of the promise qa/l8-upgrades.js proves live.
const cap = readFileSync('src/capybara.js', 'utf8');
if (/capyJUMP_HOLD\s*\*\s*capy\.mods/.test(cap) || /capyHOP_VEL\s*\*\s*capy\.mods/.test(cap)) {
  fail('the hop apex constants (capyJUMP_HOLD / capyHOP_VEL) are multiplied by a mod — the one thing not for sale');
} else {
  pass('the hop apex constants are never multiplied by capy.mods');
}

if (!process.exitCode) console.log('\nl8-catalogue: all checks passed');
else console.log('\nl8-catalogue: FAILED');
