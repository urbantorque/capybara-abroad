// L7 writing review: the nineteen chapters' sentences read sideways.
//   node qa/l7r-writing-tics.mjs
// Reads CHAPTERS from src/shared.js and counts constructions shared across
// the `left`, `note`, `open`, `sub`, `hint`, acts and notebook lines.
import { CHAPTERS, TASKS } from '../src/shared.js';

const fields = ['sub', 'hint', 'open', 'way', 'keep', 'left', 'note'];
const rows = [];
for (const c of CHAPTERS) {
  for (const f of fields) rows.push({ n: c.n, biome: c.biome, f, s: c[f] || '' });
  for (const a of (c.acts || [])) rows.push({ n: c.n, biome: c.biome, f: 'act', s: a.line || '' });
  for (const e of (c.nb || [])) {
    if (typeof e === 'string') rows.push({ n: c.n, biome: c.biome, f: 'nb', s: e });
    else { rows.push({ n: c.n, biome: c.biome, f: 'nb', s: e.t || '' }); if (e.else) rows.push({ n: c.n, biome: c.biome, f: 'nb', s: e.else }); }
  }
}
const PAT = [
  ['", and " (a clause hung on a comma-and)', /, and\b/],
  ['"You did not …"', /\bYou did not\b/],
  ['"did not" (any)', /\bdid not\b/],
  ['"Nobody / nothing / not one"', /\b(Nobody|nobody|Nothing|nothing|not one)\b/],
  ['"still" (was still / is still)', /\b(was|is|are|were|has|have) (still|not)\b/],
  ['"It has a …" (nb keepsake line)', /\bIt has (a|the|an) /],
  ['"That is …" / "That was …"', /\bThat (is|was)\b/],
  ['"I do not …" / "I did not …"', /\bI (do|did|am|was|have|could) not\b/],
  ['"the whole X"', /\bthe whole\b/],
  ['"… calls it {call}"', /calls it \{call\}/],
  ['a number spelled out', /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|forty|eighty|hundred|thousand|million)\b/i],
  ['second-person "you" in a left/note', /\byou\b/i],
  ['"apparently" / "by the look/sound of it" / "I am told" / "according to"', /\b(apparently|by the (look|sound) of it|I am told|according to|I gathered)\b/],
  ['"(and) X did not …" deadpan reversal', /\bIt did not\b|\bThey had not\b|\bit did not\b/],
  ['"here" as a closing word', /\bhere[.,]/],
  ['"on it" / "in it" ending', /\b(on|in|of|for) it\.$/],
  ['"never (once)"', /\bnever\b/],
  ['"the one … " (the one afternoon / the one night)', /\bthe one\b/],
];
console.log('rows: ' + rows.length);
for (const [name, re] of PAT) {
  const hits = rows.filter(r => re.test(r.s));
  const chap = new Set(hits.map(r => r.n));
  const byField = {};
  for (const h of hits) byField[h.f] = (byField[h.f] || 0) + 1;
  console.log(String(hits.length).padStart(3) + ' lines in ' + String(chap.size).padStart(2) + ' chapters  ' + name + '   ' + JSON.stringify(byField));
}
// the `left` and `note` pairs: how many are the same sentence twice
console.log('\nLEFT vs NOTE (shared opening words):');
for (const c of CHAPTERS) {
  const a = (c.left || '').split(/\s+/).slice(0, 4).join(' ').toLowerCase();
  const b = (c.note || '').split(/\s+/).slice(0, 4).join(' ').toLowerCase();
  const sub = (c.sub || '').toLowerCase();
  const shared = a === b ? 'SAME OPENING' : '';
  const subInLeft = sub && (c.left || '').toLowerCase().includes(sub.replace(/^and /, '').slice(0, 18)) ? 'sub-in-left' : '';
  const subInNote = sub && (c.note || '').toLowerCase().includes(sub.replace(/^and /, '').slice(0, 18)) ? 'sub-in-note' : '';
  const nb0 = (c.nb && typeof c.nb[0] === 'string') ? c.nb[0] : '';
  const subInNb = sub && nb0.toLowerCase().includes(sub.replace(/^and /, '').slice(0, 18)) ? 'sub-in-nb0' : '';
  const openInNb = c.open && nb0.toLowerCase().includes(c.open.toLowerCase().slice(0, 18)) ? 'open-in-nb0' : '';
  const flags = [shared, subInLeft, subInNote, subInNb, openInNb].filter(Boolean).join(' ');
  if (flags) console.log('  ' + c.n + ' ' + c.biome + ': ' + flags);
}
// two-sentence shape: "<statement>. You <did not …>."
console.log('\nLEFT shape census:');
let two = 0, youSecond = 0;
for (const c of CHAPTERS) {
  const s = (c.left || '').split(/(?<=\.)\s+/);
  if (s.length === 2) two++;
  if (s.length >= 2 && /^You\b/.test(s[s.length - 1])) youSecond++;
}
console.log('  two sentences: ' + two + '/19; last sentence begins "You": ' + youSecond + '/19');
// TASKS: clue register
const tasks = Object.values(TASKS || {});
console.log('\nTASKS: ' + tasks.length);
const keyed = tasks.filter(t => /\b(press|hold|tap)\b|\b[EQGWASD]\b|Space|Shift/.test((t.clue || '') + ' ' + (t.text || '')));
console.log('  clues naming a key/button: ' + keyed.length);
const imper = tasks.filter(t => /^(Steal|Knock|Make|Get|Take|Put|Find|Run|Do|Ride|Go|Climb|Cross|Sit|Eat|Jump|Hop|Swim|Dive|Catch|Follow|Let|Soak|Unload|Announce|Redesign|Carry|Bring|Push|Drop|Stand|Wheek|Chase|Pull|Hold|Be|Beat|Win|Light|Wake|Free|Ring|Throw|Tip|Roll|Leave|Reach|Land|Fly|Sail|Stay|Have|Deliver|Balance|Lie|Keep|Lose|Set|Turn|Give|Look|Walk|Open|Shake|Head|Nap|Nose|Dig|Wear|Help|Collect|Meet|Wait|Watch|Herd|Round|Send|Drag|Board|Start|Steer|Tow|Slide|Surf|Pinch|Nick|Sneak|Startle|Spook|Scare|Hide|Scatter|Trip|Escape|Outrun|Lead)\b/.test(t.text || ''));
console.log('  rows beginning with an imperative verb: ' + imper.length + '/' + tasks.length);
const starts = {};
for (const t of tasks) { const w = (t.text || '').split(' ')[0]; starts[w] = (starts[w] || 0) + 1; }
console.log('  top first words: ' + Object.entries(starts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(e => e[0] + ' ' + e[1]).join(', '));
