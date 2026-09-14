// THE VOCABULARY OF A PLACE IS NOT PITCH-SHIFTED SYDNEY (L7, E2 / audio 5).
//
// A generic voice — the twelve one-shots chapter one was written with — played
// half an octave or more off its recipe is a borrowed word: a `tick` at 2.4 is
// "a bicycle bell", a `hiss` at 0.3 is "a penguin", a `gull` at 0.44 is "a
// heron", and the ear knows none of them is. The audio review counted 122 such
// call sites over src/ (Hanoi's 2.5-minute drive: 722 of 1 398 calls were three
// Sydney generics transposed). This keeps that count as a number `npm test`
// prints, and fails only above the ceiling — a chapter is allowed a handful
// of far-off transpositions (a bush warbler out of `pop` at 3.0 is fine),
// what it is not allowed is a whole soundscape of them.
//
// Static, like qa/verbs.mjs: reads the sources, no browser, well under a
// second. It looks for `<anything>('<generic>', ...)` and reads the pitch out
// of the argument list — an options object's `pitch: N` or `pitch: rand(a, b)`,
// or hanoi.js's positional `hanCue(name, x, y, z, volume, pitch)`. A call with
// no pitch is at 1 and is not counted.
import { readFileSync, readdirSync } from 'node:fs';

const GENERIC = ['bark', 'tick', 'hiss', 'chime', 'gull', 'splash', 'pop', 'thud',
                 'horn', 'whistle', 'strum', 'rustle'];
const LO = 0.7, HI = 1.4;
const CEILING = 30;

const dir = new URL('../src/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();

/** The balanced argument list starting at `i` (the '(' after the callee). */
function args(src, i) {
  let depth = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return src.slice(i + 1, k); }
    else if (c === "'" || c === '"' || c === '`') {
      const q = c; k++;
      while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++; }
    }
  }
  return src.slice(i + 1);
}

/** [lo, hi] of the pitch written into an argument list, or null for "at 1". */
function pitchOf(callee, a) {
  const m = /\bpitch\s*:\s*(?:rand\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)|([\d.]+))/.exec(a);
  if (m) return m[3] !== undefined ? [+m[3], +m[3]] : [+m[1], +m[2]];
  if (callee === 'hanCue') {
    // positional: name, x, y, z, volume, pitch — split at depth 0 only
    const parts = []; let depth = 0, cur = '';
    for (const c of a) {
      if (c === '(' || c === '[' || c === '{') depth++;
      if (c === ')' || c === ']' || c === '}') depth--;
      if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += c;
    }
    parts.push(cur.trim());
    const p = parts[5];
    if (!p) return null;
    const r = /^rand\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(p);
    if (r) return [+r[1], +r[2]];
    if (/^[\d.]+$/.test(p)) return [+p, +p];
    return null;
  }
  return null;
}

const rows = [];
const perFile = {};
for (const f of files) {
  const src = readFileSync(new URL(f, dir), 'utf8');
  const re = new RegExp("\\b([A-Za-z_$][\\w$]*)\\(\\s*'(" + GENERIC.join('|') + ")'\\s*,", 'g');
  let m;
  while ((m = re.exec(src))) {
    const callee = m[1];
    // the table itself, the gap table, the caption table and the lint's own
    // vocabulary are not calls
    if (callee === 'sfxGap' || callee === 'RegExp') continue;
    const a = args(src, m.index + m[0].length - m[0].split('(').slice(1).join('(').length - 1);
    const p = pitchOf(callee, a);
    if (!p) continue;
    if (p[0] < LO || p[1] > HI) {
      const line = src.slice(0, m.index).split('\n').length;
      rows.push({ f, line, callee, name: m[2], lo: p[0], hi: p[1] });
      perFile[f] = (perFile[f] || 0) + 1;
    }
  }
}

rows.sort((a, b) => a.f.localeCompare(b.f) || a.line - b.line);
for (const r of rows) {
  console.log('  ' + (r.f + ':' + r.line).padEnd(22) + r.callee.padEnd(9) + r.name.padEnd(8) +
              (r.lo === r.hi ? String(r.lo) : r.lo + '–' + r.hi));
}
console.log('per file: ' + Object.keys(perFile).sort().map(k => k.replace('.js', '') + ' ' + perFile[k]).join(', '));
console.log('generic voices off-pitch (outside ' + LO + '–' + HI + '): ' + rows.length +
            ' call sites (ceiling ' + CEILING + ')');
if (rows.length > CEILING) {
  console.log('FAIL: ' + rows.length + ' > ' + CEILING + ' — a place is speaking in borrowed words. See sfxTable, E2.');
  process.exit(1);
}
