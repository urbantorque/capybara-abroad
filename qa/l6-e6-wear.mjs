// qa/l6-e6-wear.mjs — is the wear path (mergeWearBand, L6 E6) in the picture?
// Reads qa/l6-e6-wear.json.png (from qa/l6-e6-wear.js): for every sample
// across the band (offsets -3, -2, 0, +2, +3 m from the centreline) that is
// in front of the lens, inside the frame and within 45 m, the mean luma of a
// 5x5 window at the projected point. Reports, per chapter, the median of
// (centre - mean of the four sides): a band 8 % darker on a luma-150 ground
// is about -12; zero is a band that is not there.
//   node qa/l6-e6-wear.mjs
import { pngRead } from './pnghist.mjs';
import { readFileSync } from 'node:fs';
const J = JSON.parse(readFileSync('qa/l6-e6-wear.json.png', 'utf8'));
function inHud(x, y, w, h) { return (x < w * 0.24 && y < h * 0.47) || (x > w * 0.84 && y > h * 0.73); }
for (const r of J.rows) {
  const f = 'qa/l6-e6-wear-' + r.biome + '.png';
  const { w, h, chan, data } = pngRead(f);
  const L = (x, y) => { let s = 0, n = 0; for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) { if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const i = (yy * w + xx) * chan; s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++; } return n ? s / n : NaN; };
  const diffs = [], used = [];
  for (const row of r.samples) {
    if (!row.every(p => p.front && p.sx >= 0 && p.sx < w && p.sy >= 0 && p.sy < h && p.d < 45 && !inHud(p.sx, p.sy, w, h))) continue;
    const c = row.find(p => p.off === 0), sides = row.filter(p => p.off !== 0);
    const lc = L(c.sx, c.sy), ls = sides.reduce((s, p) => s + L(p.sx, p.sy), 0) / sides.length;
    diffs.push(lc - ls); used.push({ x: c.x, z: c.z, d: c.d, lc: +lc.toFixed(0), ls: +ls.toFixed(0) });
  }
  diffs.sort((a, b) => a - b);
  const med = diffs.length ? diffs[Math.floor(diffs.length / 2)] : NaN;
  console.log(r.biome.padEnd(9) + ' th=' + r.hasTh + ' err=' + r.err + ' samples=' + diffs.length + ' median(centre-sides)=' + (isNaN(med) ? 'n/a' : med.toFixed(1)) +
    ' min=' + (diffs.length ? diffs[0].toFixed(1) : '-') + ' max=' + (diffs.length ? diffs[diffs.length - 1].toFixed(1) : '-'));
  for (const u of used.slice(0, 6)) console.log('   at (' + u.x + ', ' + u.z + ') d ' + u.d + ': centre ' + u.lc + ' sides ' + u.ls);
}
