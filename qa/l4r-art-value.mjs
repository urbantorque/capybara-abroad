// qa/l4r-art-value.mjs — value structure and colour discipline of a frame,
// for the L4 art review. Reads the settled PNGs with qa/pnghist.mjs.
//
//   node qa/l4r-art-value.mjs qa/l4-*.png
//
// Per frame (HUD corners excluded, every 2nd pixel):
//   p01 p05 p50 p95 p99   luma percentiles, 0..255
//   dark%   share of pixels under luma 64  (a shipped daylight frame: 4–15%)
//   deep%   share under luma 40             (a shadow core, an interior, a dark accent)
//   hi%     share over luma 230             (a real highlight — sun on water, a white wall)
//   range   p99 - p01                       (a full-value picture is 200+)
//   sat     mean HSV saturation 0..1, and the share of pixels over 0.5
//   hues    how many 30° hue bins carry more than 3% of the chromatic pixels
//   edge%   share of pixels whose 4-neighbour luma step exceeds 24 (detail / texture)
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
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    if (inHud(x, y, w, h)) continue;
    const k = y * w + x, i = k * chan;
    const l = L[k]; all.push(l); n++;
    if (l < 64) dark++; if (l < 40) deep++; if (l > 230) hi++;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const s = mx > 0 ? d / mx : 0;
    satS += s; if (s > 0.5) satHi++;
    if (d > 0.08) {
      let hh;
      if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4;
      hh = (hh * 60 + 360) % 360;
      hueBins[Math.floor(hh / 30)]++; chromN++;
    }
    const e = Math.max(Math.abs(l - L[k - 1]), Math.abs(l - L[k + 1]), Math.abs(l - L[k - w]), Math.abs(l - L[k + w]));
    if (e > 24) edges++;
  }
  all.sort((p, q) => p - q);
  const q = p => all[Math.floor((all.length - 1) * p)];
  const hues = hueBins.filter(c => c / Math.max(1, chromN) > 0.03).length;
  return {
    file: path.split(/[\\/]/).pop().replace('l4-', '').replace('.png', ''),
    p01: +q(0.01).toFixed(0), p05: +q(0.05).toFixed(0), p50: +q(0.5).toFixed(0), p95: +q(0.95).toFixed(0), p99: +q(0.99).toFixed(0),
    range: +(q(0.99) - q(0.01)).toFixed(0),
    dark: +(100 * dark / n).toFixed(1), deep: +(100 * deep / n).toFixed(1), hi: +(100 * hi / n).toFixed(1),
    sat: +(satS / n).toFixed(2), satHi: +(100 * satHi / n).toFixed(1), hues, edge: +(100 * edges / n).toFixed(1),
  };
}
const files = process.argv.slice(2);
const pad = (s, n) => String(s).padStart(n);
console.log('frame'.padEnd(18) + ' p01 p05 p50 p95 p99 rng | dark% deep%  hi% | sat sat>.5 hues | edge%');
for (const f of files) {
  try {
    const r = value(f);
    console.log(r.file.padEnd(18) + pad(r.p01, 4) + pad(r.p05, 4) + pad(r.p50, 4) + pad(r.p95, 4) + pad(r.p99, 4) + pad(r.range, 4) +
      ' |' + pad(r.dark, 6) + pad(r.deep, 6) + pad(r.hi, 5) + ' |' + pad(r.sat, 4) + pad(r.satHi, 7) + pad(r.hues, 5) + ' |' + pad(r.edge, 6));
  } catch (e) { console.log(f + ': ' + e.message); }
}
