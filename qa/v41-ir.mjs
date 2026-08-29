// Measure the impulse responses musIR() actually builds, offline.
//
// A live probe can tell you the mix got wider and did not clip; it cannot tell
// you a reverb has a pre-delay, where its early reflections are, or that its
// tail darkens — those are properties of a buffer, and the buffer is cheap to
// rebuild here. The code below is lifted verbatim from systems.js musIR; if
// this file and that function ever disagree, this file is the one that is wrong.
//
//   node qa/v41-ir.mjs

import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/systems.js', import.meta.url), 'utf8');
function num(name) {
  const m = SRC.match(new RegExp('const ' + name + '\\s*=\\s*([-0-9.]+)'));
  if (!m) throw new Error('no ' + name);
  return parseFloat(m[1]);
}
function arr(name) {
  const m = SRC.match(new RegExp('const ' + name + '\\s*=\\s*\\[([^\\]]+)\\]'));
  if (!m) throw new Error('no ' + name);
  return m[1].split(',').map(s => parseFloat(s));
}
const PRE_MAX = num('sysIR_PRE_MAX');
const LP0 = num('sysIR_LP0'), LP1 = num('sysIR_LP1');
const ER = arr('sysIR_ER'), ER_G = num('sysIR_ER_G');
const ER_SPAN = num('sysIR_ER_SPAN'), BUILD = num('sysIR_BUILD');
const ER_REF = num('sysIR_ER_REF'), ER_BASE = num('sysIR_ER_BASE'), ER_K = num('sysIR_ER_K');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const RATE = 48000;
function musIR(secs, decay) {
  const pd = clamp(0.006 + secs * 0.0068, 0.006, PRE_MAX);
  const p = Math.floor(RATE * pd);
  const n = Math.max(1, Math.floor(RATE * secs) + p);
  const atk = Math.max(1, Math.floor(RATE * 0.006));
  const body = n - p;
  const erSpan = clamp((secs - ER_REF) * ER_K + ER_BASE, 0.012, ER_SPAN);
  const erN = Math.max(1, Math.floor(RATE * erSpan));
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float64Array(n);
    let lp = 0;
    for (let i = 0; i < body; i++) {
      const k = LP0 + (LP1 - LP0) * (i / body);
      lp = lp * k + (Math.random() * 2 - 1) * 0.4842 * Math.sqrt(1 - k * k);
      const tail = Math.pow(1 - i / body, decay);
      const bld = i < erN ? BUILD + (1 - BUILD) * (i / erN) : 1;
      d[i + p] = lp * tail * bld * (i < atk ? i / atk : 1);
    }
    for (let e = 0; e < ER.length; e++) {
      const j = p + Math.floor(RATE * ER[e] * erSpan * (ch ? 1.083 : 0.941));
      if (j >= n) break;
      d[j] += (e & 1 ? -1 : 1) * ER_G / (1 + 2.6 * ER[e]);
    }
    out.push(d);
  }
  return { d: out, n, pre: pd, erSpan };
}

// zero-crossing rate over a window == a cheap, honest brightness measure
function zcr(d, a, b) {
  let z = 0, prev = d[a];
  for (let i = a + 1; i < b; i++) { if ((d[i] >= 0) !== (prev >= 0)) z++; prev = d[i]; }
  return z / (b - a) * RATE / 2;      // ~ dominant frequency, Hz
}
function rms(d, a, b) {
  let s = 0;
  for (let i = a; i < b; i++) s += d[i] * d[i];
  return Math.sqrt(s / (b - a));
}

const ROOM_A = num('sysMUS_ROOM_A'), ROOM_B = num('sysMUS_ROOM_B');
const ROOM_MIN = num('sysMUS_ROOM_MIN'), ROOM_MAX = num('sysMUS_ROOM_MAX');
const WET = num('sysMUS_WET'), WET_MIN = num('sysMUS_WET_MIN'), WET_MAX = num('sysMUS_WET_MAX');
const WET_BASE = num('sysMUS_WET_BASE'), WET_SPR = num('sysMUS_WET_SPR'), WET_REF = num('sysMUS_WET_REF');

// the sysROOMS table, straight out of the source
const tbl = SRC.match(/const sysROOMS = \{([\s\S]*?)\n\};/)[1];
const ROOMS = {};
for (const m of tbl.matchAll(/^\s*([a-z]+):\s*\{ size: ([\d.]+), decay: ([\d.]+), wet: ([\d.]+) \}/gm)) {
  ROOMS[m[1]] = { size: +m[2], decay: +m[3], wet: +m[4] };
}

console.log('chapter    size  musSecs  decay   wet   pre_ms  ER_ms  ERpk/tail  bright_head  bright_tail  RT60_s');
console.log('-'.repeat(104));
const names = Object.keys(ROOMS);
for (const name of names) {
  const R = ROOMS[name];
  const secs = clamp(ROOM_A + R.size * ROOM_B, ROOM_MIN, ROOM_MAX);
  const dec = clamp(R.decay * 0.85 + 0.5, 1.4, 3.6);
  const wet = clamp(WET * (WET_BASE + R.wet * WET_SPR) * Math.sqrt(WET_REF / secs), WET_MIN, WET_MAX);
  const ir = musIR(secs, dec);
  const d = ir.d[0];
  const p = Math.floor(RATE * ir.pre);

  // pre-delay: first sample above the noise floor
  let first = 0;
  for (let i = 0; i < ir.n; i++) { if (Math.abs(d[i]) > 1e-6) { first = i; break; } }

  // early reflections: peak in the ER window vs the diffuse level just after it
  const erEnd = p + Math.floor(RATE * ir.erSpan);
  let erPk = 0;
  for (let i = p; i < erEnd; i++) if (Math.abs(d[i]) > erPk) erPk = Math.abs(d[i]);
  const diffuse = rms(d, erEnd, erEnd + Math.floor(RATE * 0.05));

  // brightness at the head of the tail and at the end of it
  const bh = zcr(d, erEnd, erEnd + Math.floor(RATE * 0.2));
  const bt = zcr(d, ir.n - Math.floor(RATE * 0.25), ir.n - 100);

  // RT60: where the windowed rms falls 60 dB below the level just after the ERs
  const ref = diffuse;
  let rt = secs;
  const step = Math.floor(RATE * 0.02);
  for (let i = erEnd; i + step < ir.n; i += step) {
    if (rms(d, i, i + step) < ref / 1000) { rt = (i - p) / RATE; break; }
  }
  console.log(
    name.padEnd(10) +
    String(R.size).padStart(5) +
    secs.toFixed(2).padStart(9) +
    dec.toFixed(2).padStart(7) +
    wet.toFixed(2).padStart(6) +
    (ir.pre * 1000).toFixed(1).padStart(8) +
    (ir.erSpan * 1000).toFixed(0).padStart(7) +
    (erPk / diffuse).toFixed(2).padStart(11) +
    (bh | 0).toString().padStart(13) +
    (bt | 0).toString().padStart(13) +
    rt.toFixed(2).padStart(8));
  if (first > p + 2) console.log('   !! pre-delay is ' + first + ' samples, expected ' + p);
}

// ---- and the old shape, for the differential ------------------------------
function oldIR(secs, decay) {
  const n = Math.floor(RATE * secs);
  const d = new Float64Array(n);
  const atk = Math.max(1, Math.floor(RATE * 0.006));
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp = lp * 0.62 + (Math.random() * 2 - 1) * 0.38;
    d[i] = lp * Math.pow(1 - i / n, decay) * (i < atk ? i / atk : 1);
  }
  return d;
}
const o = oldIR(3.6, 2.4);
console.log('\nWAS (one IR for all nineteen chapters):  3.60 s, decay 2.40, wet ' + WET.toFixed(2) +
  ', pre 0.0 ms, no early reflections');
console.log('  brightness head ' + (zcr(o, 0, RATE * 0.2) | 0) +
  ' Hz, tail ' + (zcr(o, o.length - RATE * 0.25, o.length - 100) | 0) + ' Hz  (flat: it never darkens)');
