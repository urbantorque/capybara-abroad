// qa/m9-voice.mjs — DOES EVERY PLACE STILL SOUND LIKE ITSELF?
//
//   node qa/m9-voice.mjs
//
// npcPLACE_SAY is the pool a player hears more than any other in the game:
// npcHEAT_SOON drops the wary bar to 0.14 in a square that is already cross
// with you, so being a menace is mostly this table. Before M9 it had five
// chapters sharing a byte-identical wary[0], fifteen of seventeen phrasing
// wary[1] as "I know / I remember", and SEVENTEEN OF SEVENTEEN opening
// incident[0] on the number three.
//
// None of that is visible from inside a chapter, which is why it lasted: every
// row reads fine on its own and the table only fails when you read it
// sideways. This does that, statically, with no browser.
//
// It is deliberately a set of CEILINGS rather than a style guide. A template is
// a distribution, not a bad sentence — and the checks are on distributions for a
// second reason too: the first cut of this tested `incident[0]` and reported
// 17 of 17 after the rewrite, which was true and meant nothing, because
// localLine SHUFFLES the bag. Position in this table is not position in play.
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/npc.js', import.meta.url);
const src = readFileSync(SRC, 'utf8');

const start = src.indexOf('const npcPLACE_SAY = {');
if (start < 0) { console.error('npcPLACE_SAY not found'); process.exit(2); }
const body = src.slice(start, src.indexOf('\n  };\n', start));

// Chapter blocks: `name: {` down to the next one.
const rows = [];
const re = /^    ([a-z]+): \{$/gm;
let m; const marks = [];
while ((m = re.exec(body))) marks.push({ name: m[1], at: m.index });
for (let i = 0; i < marks.length; i++) {
  const chunk = body.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : body.length);
  const row = { name: marks[i].name };
  for (const k of ['wary', 'incident']) {
    const kx = chunk.indexOf(k + ':');
    if (kx < 0) continue;
    const open = chunk.indexOf('[', kx), close = chunk.indexOf('],', open);
    row[k] = (chunk.slice(open, close).match(/'((?:[^'\\]|\\.)*)'/g) || [])
               .map(t => t.slice(1, -1));
  }
  rows.push(row);
}

let fail = 0;
const say = (ok, msg) => { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const all = (r) => (r.wary || []).concat(r.incident || []);

console.log(rows.length + ' chapters, ' +
            rows.reduce((a, r) => a + all(r).length, 0) + ' lines\n');

// 1. every line is unique across the whole table
{
  const seen = new Map(); const dupes = [];
  for (const r of rows) for (const s of all(r)) {
    if (seen.has(s)) dupes.push('"' + s + '" [' + seen.get(s) + ' + ' + r.name + ']');
    else seen.set(s, r.name);
  }
  say(dupes.length === 0, 'no line is said in two chapters' +
      (dupes.length ? ' — ' + dupes.join('; ') : ''));
}

// 2. depth. Three was the old figure and it is what left the neutral pool at 70%.
{
  const thin = rows.filter(r => (r.wary || []).length < 6 || (r.incident || []).length < 6)
                   .map(r => r.name + ' ' + (r.wary || []).length + '/' + (r.incident || []).length);
  say(thin.length === 0, 'every chapter carries six of each' +
      (thin.length ? ' — thin: ' + thin.join(', ') : ''));
}

// 3. the count, as a SHARE of each pool. A count is a fine reaction to a chain;
// seventeen chapters all reaching for it is a template wearing seventeen hats.
{
  const isCount = (s) => /\b(three|tres|third)\b/i.test(s);
  const per = rows.map(r => ({ n: r.name, k: (r.incident || []).filter(isCount).length,
                               of: (r.incident || []).length }));
  const worst = per.filter(p => p.k > 2);
  const tot = per.reduce((a, p) => a + p.k, 0);
  const of = per.reduce((a, p) => a + p.of, 0);
  say(worst.length === 0, 'no chapter is more than a third counts — worst ' +
      per.slice().sort((x, y) => y.k - x.k).slice(0, 3)
         .map(p => p.n + ' ' + p.k + '/' + p.of).join(', '));
  say(tot / of <= 0.30, 'counts are under a third of the whole table — ' +
      tot + '/' + of + ' = ' + (100 * tot / of).toFixed(0) + '%');
}

// 4. the recognition. Same rule, same reason.
{
  const isKnow = (s) => /\b(i know|i remember)\b/i.test(s);
  const k = rows.reduce((a, r) => a + (r.wary || []).filter(isKnow).length, 0);
  const of = rows.reduce((a, r) => a + (r.wary || []).length, 0);
  say(k / of <= 0.30, 'at most a third of wary lines are "I know / I remember" — ' +
      k + '/' + of + ' = ' + (100 * k / of).toFixed(0) + '%');
}

// 5. THE LOG GAG — four chapters ran the same joke with the same noun, a person
// deciding to write the animal down. Antarctica keeps it and is the best of the
// four. Matched on the gag rather than on the words, so Monte Carlo's guest list
// and its forms are not caught by it.
{
  const GAG = /(in the (log|survey|book)|going in the (log|book)|no column|column for|writing this one down|the log is)/i;
  const hit = rows.filter(r => all(r).some(s => GAG.test(s)));
  say(hit.length <= 1, 'at most one chapter reaches for the log/column gag — ' +
      (hit.map(r => r.name).join(' ') || 'none'));
}

// 6. nothing names what the player did. An incident line is a person reacting
// to a square, not a receipt — that rule predates this pass and is kept.
{
  const RECEIPT = /\b(you (took|stole|broke|threw|knocked|spilled|dropped)|that (hat|bin|cone|sandwich|camera) you)\b/i;
  const bad = [];
  for (const r of rows) for (const s of (r.incident || []))
    if (RECEIPT.test(s)) bad.push(r.name + ': ' + s);
  say(bad.length === 0, 'no incident line is a receipt' +
      (bad.length ? ' — ' + bad.join('; ') : ''));
}

console.log('\n' + (fail ? fail + ' FAILED' : 'all clear'));
process.exit(fail ? 1 : 0);
