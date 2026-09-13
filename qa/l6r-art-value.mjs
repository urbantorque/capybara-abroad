// qa/l6r-art-value.mjs — the L6 art review's frame metrics. Same shape as
// qa/l4r-art-value.mjs (p01/p50/p99 luma, dark share, saturation, edge density)
// plus three things this review asked for:
//   skyRow%  share of the TOP 12% of the frame that reads as sky (low edge, smooth)
//   band     mean luma of three horizontal bands (top / middle / bottom third)
//   bandSd   luma sd of each band — a flat band is a flat picture
//   cLum     mean luma in a 160x120 window round the frame centre-right, where the
//            animal stands at the resting lens (0.50, 0.58) — and its local edge%
//
//   node qa/l6r-art-value.mjs qa/l6r-art-*.png
import { pngRead } from './pnghist.mjs';

function inHud(x, y, w, h) {
  if (x < w * 0.24 && y < h * 0.47) return true;
  if (x > w * 0.84 && y > h * 0.73) return true;
  return false;
}
export function value(path) {
  const { w, h, chan, data } = pngRead(path);
  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * chan;
    L[y * w + x] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  const all = []; let n = 0, dark = 0, deep = 0, hi = 0, satS = 0, satHi = 0, edges = 0, chromN = 0;
  const hueBins = new Array(12).fill(0);
  const band = [0, 0, 0], bandN = [0, 0, 0], bandSq = [0, 0, 0];
  let topN = 0, topFlat = 0;
  let cN = 0, cL = 0, cE = 0;
  const cx0 = Math.floor(w * 0.50) - 80, cy0 = Math.floor(h * 0.58) - 60;
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    const k = y * w + x, i = k * chan;
    const l = L[k];
    const e = Math.max(Math.abs(l - L[k - 1]), Math.abs(l - L[k + 1]), Math.abs(l - L[k - w]), Math.abs(l - L[k + w]));
    if (y < h * 0.12 && !inHud(x, y, w, h)) { topN++; if (e < 4) topFlat++; }
    if (x >= cx0 && x < cx0 + 160 && y >= cy0 && y < cy0 + 120) { cN++; cL += l; if (e > 24) cE++; }
    if (inHud(x, y, w, h)) continue;
    all.push(l); n++;
    const b = Math.min(2, Math.floor(y / h * 3)); band[b] += l; bandSq[b] += l * l; bandN[b]++;
    if (l < 64) dark++; if (l < 40) deep++; if (l > 230) hi++;
    const r = data[i] / 255, g = data[i + 1] / 255, bb = data[i + 2] / 255;
    const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb), d = mx - mn;
    const s = mx > 0 ? d / mx : 0;
    satS += s; if (s > 0.5) satHi++;
    if (d > 0.08) {
      let hh;
      if (mx === r) hh = ((g - bb) / d) % 6; else if (mx === g) hh = (bb - r) / d + 2; else hh = (r - g) / d + 4;
      hh = (hh * 60 + 360) % 360;
      hueBins[Math.floor(hh / 30)]++; chromN++;
    }
    if (e > 24) edges++;
  }
  all.sort((p, q) => p - q);
  const q = p => all[Math.floor((all.length - 1) * p)];
  const hues = hueBins.filter(c => c / Math.max(1, chromN) > 0.03).length;
  const bm = band.map((s, i) => s / Math.max(1, bandN[i]));
  const bsd = band.map((s, i) => Math.sqrt(Math.max(0, bandSq[i] / Math.max(1, bandN[i]) - bm[i] * bm[i])));
  return {
    file: path.split(/[\\/]/).pop().replace('l6r-art-', '').replace('.png', ''),
    p01: +q(0.01).toFixed(0), p05: +q(0.05).toFixed(0), p50: +q(0.5).toFixed(0), p95: +q(0.95).toFixed(0), p99: +q(0.99).toFixed(0),
    range: +(q(0.99) - q(0.01)).toFixed(0),
    dark: +(100 * dark / n).toFixed(1), deep: +(100 * deep / n).toFixed(1), hi: +(100 * hi / n).toFixed(1),
    sat: +(satS / n).toFixed(2), satHi: +(100 * satHi / n).toFixed(1), hues, edge: +(100 * edges / n).toFixed(1),
    skyRow: +(100 * topFlat / Math.max(1, topN)).toFixed(0),
    band: bm.map(v => +v.toFixed(0)), bandSd: bsd.map(v => +v.toFixed(0)),
    cLum: +(cL / Math.max(1, cN)).toFixed(0), cEdge: +(100 * cE / Math.max(1, cN)).toFixed(1),
  };
}
const files = process.argv.slice(2);
const pad = (s, n) => String(s).padStart(n);
console.log('frame'.padEnd(18) + ' p01 p05 p50 p95 p99 rng | dark% deep%  hi% | sat sat>.5 hues | edge% | top-flat% | band t/m/b | sd t/m/b | ctr lum/edge');
for (const f of files) {
  try {
    const r = value(f);
    console.log(r.file.padEnd(18) + pad(r.p01, 4) + pad(r.p05, 4) + pad(r.p50, 4) + pad(r.p95, 4) + pad(r.p99, 4) + pad(r.range, 4) +
      ' |' + pad(r.dark, 6) + pad(r.deep, 6) + pad(r.hi, 5) + ' |' + pad(r.sat, 4) + pad(r.satHi, 7) + pad(r.hues, 5) + ' |' + pad(r.edge, 6) +
      ' |' + pad(r.skyRow, 8) + '  | ' + r.band.join('/').padEnd(11) + '| ' + r.bandSd.join('/').padEnd(9) + '| ' + r.cLum + '/' + r.cEdge);
  } catch (e) { console.log(f + ': ' + e.message); }
}
