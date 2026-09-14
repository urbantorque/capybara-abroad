// qa/l7-e4-water.mjs — THE REFLECTION's two instruments (L7, E4 / art #7), read
// off the frames qa/l7-e4-water.js / qa/l7-e4-water-hk.js took, on and off.
//   quay: per west pile of the middle wharf, the water's luma along the line
//         from the pile's foot toward the eye against the water 2 m to either
//         side at the same distance — a dark column is col ≤ side − 8.
//   hk:   the shore strip 0.5–3 m over the waterline against each point's
//         mirror on the harbour — Pearson r.
//   node qa/l7-e4-water.mjs
import { readFileSync, existsSync } from 'node:fs';
import { pngRead } from './pnghist.mjs';
function lumaAt(img, x, y) {
  const { w, h, chan, data } = img;
  if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return null;
  let s = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = ((y + dy) * w + (x + dx)) * chan;
    s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
  }
  return s / n;
}
const pad = (s, n) => String(s).padStart(n);
function quay(q, png, label) {
  const img = pngRead(png);
  const byPile = new Map();
  for (const r of q.rows) {
    if (r.col[2] > 1 || r.col[2] < -1) continue;
    const c = lumaAt(img, r.col[0], r.col[1]);
    const s1 = lumaAt(img, r.side[0], r.side[1]), s2 = lumaAt(img, r.side2[0], r.side2[1]);
    if (c === null || (s1 === null && s2 === null)) continue;
    const side = s1 === null ? s2 : s2 === null ? s1 : Math.max(s1, s2);
    const k = r.pile.join(',');
    if (!byPile.has(k)) byPile.set(k, []);
    byPile.get(k).push({ s: r.s, c, side, d: side - c });
  }
  let dark = 0, n = 0;
  console.log(label + '  cam ' + JSON.stringify(q.cam) + ' capy ' + JSON.stringify(q.capy) + ' swimming ' + q.swimming + '  bounce live ' +
    JSON.stringify(q.bounce.live.map(l => l.at.join(',') + ' ' + l.c.map(v => v.toFixed(3)).join('/'))));
  for (const [k, a] of byPile) {
    const best = a.reduce((p, x) => x.d > p.d ? x : p, a[0]);
    n++; if (best.d >= 8) dark++;
    console.log('  pile ' + k.padEnd(12) + ' best side−col ' + pad(best.d.toFixed(1), 6) + ' at s ' + best.s + '   col/side ' + a.map(v => v.c.toFixed(0) + '/' + v.side.toFixed(0)).join(' '));
  }
  console.log('  dark columns (≥ 8 below the water 2 m away): ' + dark + '/' + n + '  err ' + q.err);
}
function hk(q, png, label) {
  const img = pngRead(png);
  const A = [], B = [];
  for (const r of q.rows) {
    if (r.above[2] > 1 || r.below[2] > 1 || r.above[2] < -1 || r.below[2] < -1) continue;
    const a = lumaAt(img, r.above[0], r.above[1]), b = lumaAt(img, r.below[0], r.below[1]);
    if (a === null || b === null) continue;
    A.push(a); B.push(b);
  }
  const mean = a => a.reduce((p, x) => p + x, 0) / Math.max(1, a.length);
  const ma = mean(A), mb = mean(B);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < A.length; i++) { sab += (A[i] - ma) * (B[i] - mb); saa += (A[i] - ma) ** 2; sbb += (B[i] - mb) ** 2; }
  const r = sab / Math.sqrt(Math.max(1e-9, saa * sbb));
  console.log(label + '  cam ' + JSON.stringify(q.cam) + ' capy ' + JSON.stringify(q.capy) + ' swimming ' + q.swimming + '  n ' + A.length +
    '  strip mean ' + ma.toFixed(1) + ' sd ' + Math.sqrt(saa / Math.max(1, A.length)).toFixed(1) +
    '  mirror mean ' + mb.toFixed(1) + ' sd ' + Math.sqrt(sbb / Math.max(1, B.length)).toFixed(1) + '  r = ' + r.toFixed(3) + '  err ' + q.err);
}
if (existsSync('qa/l7-e4-water.json.png')) {
  const j = JSON.parse(readFileSync('qa/l7-e4-water.json.png', 'utf8'));
  if (j.quay) quay(j.quay, 'qa/l7-e4-water-quay.png', 'quay ON ');
  if (j.quayOff) quay(j.quayOff, 'qa/l7-e4-water-quay-off.png', 'quay OFF');
}
if (existsSync('qa/l7-e4-water-hk.json.png')) {
  const j = JSON.parse(readFileSync('qa/l7-e4-water-hk.json.png', 'utf8'));
  if (j.hk) hk(j.hk, 'qa/l7-e4-water-hk.png', 'kowloon ON ');
  if (j.hkOff) hk(j.hkOff, 'qa/l7-e4-water-hk-off.png', 'kowloon OFF');
}
