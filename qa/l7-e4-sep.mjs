// qa/l7-e4-sep.mjs — the animal's value separation from its surround, per
// settled frame. Reads the animal's projected box from qa/l7-e4-shots.json.png
// (cx, cy, w, h in frame fractions / px) and compares the luma inside the box
// (shrunk 20 % so the box's corners are mostly animal) against an annulus
// 0.6–1.4 box-widths out. Also the share of the whole frame (HUD excluded)
// whose local 4-px edge is under 3 — "one flat value".
//   node qa/l7-e4-sep.mjs
import { readFileSync } from 'node:fs';
import { pngRead } from './pnghist.mjs';
const rows = JSON.parse(readFileSync('qa/l7-e4-shots.json.png', 'utf8')).rows;
function inHud(x, y, w, h) {
  if (x < w * 0.24 && y < h * 0.47) return true;
  if (x > w * 0.84 && y > h * 0.73) return true;
  return false;
}
const pad = (s, n) => String(s).padStart(n);
console.log('frame'.padEnd(18) + ' animL  ringL  dL   animSd ringSd | hueA hueR dHue | flat% (edge<3) | flat8% (8x8 blocks sd<2)');
for (const r of rows) {
  const path = 'qa/l7-e4-' + r.biome + '-' + r.tag + '.png';
  let img; try { img = pngRead(path); } catch (e) { console.log(path, e.message); continue; }
  const { w, h, chan, data } = img;
  const L = new Float32Array(w * h), H = new Float32Array(w * h), C = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * chan; const R = data[i] / 255, G = data[i + 1] / 255, B = data[i + 2] / 255;
    L[y * w + x] = 0.2126 * R * 255 + 0.7152 * G * 255 + 0.0722 * B * 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn; C[y * w + x] = d;
    let hh = 0; if (d > 0.02) { if (mx === R) hh = ((G - B) / d) % 6; else if (mx === G) hh = (B - R) / d + 2; else hh = (R - G) / d + 4; hh = (hh * 60 + 360) % 360; }
    H[y * w + x] = hh;
  }
  const cx = r.capyPx.cx * w, cy = r.capyPx.cy * h, bw = r.capyPx.w, bh = r.capyPx.h;
  let aN = 0, aS = 0, aQ = 0, rN = 0, rS = 0, rQ = 0, aH = 0, rH = 0, aHn = 0, rHn = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.abs(x - cx) / (bw * 0.5), dy = Math.abs(y - cy) / (bh * 0.5);
    const k = y * w + x; const l = L[k];
    if (dx < 0.8 && dy < 0.8) { aN++; aS += l; aQ += l * l; if (C[k] > 0.08) { aH += H[k]; aHn++; } }
    else if (dx < 1.6 && dy < 1.6 && (dx > 1.1 || dy > 1.1)) { rN++; rS += l; rQ += l * l; if (C[k] > 0.08) { rH += H[k]; rHn++; } }
  }
  const am = aS / Math.max(1, aN), rm = rS / Math.max(1, rN);
  const asd = Math.sqrt(Math.max(0, aQ / Math.max(1, aN) - am * am)), rsd = Math.sqrt(Math.max(0, rQ / Math.max(1, rN) - rm * rm));
  const ah = aH / Math.max(1, aHn), rh = rH / Math.max(1, rHn);
  let dh = Math.abs(ah - rh); if (dh > 180) dh = 360 - dh;
  // flat share, two ways
  let n = 0, flat = 0;
  for (let y = 2; y < h - 2; y += 2) for (let x = 2; x < w - 2; x += 2) {
    if (inHud(x, y, w, h)) continue; n++;
    const k = y * w + x; const l = L[k];
    const e = Math.max(Math.abs(l - L[k - 2]), Math.abs(l - L[k + 2]), Math.abs(l - L[k - 2 * w]), Math.abs(l - L[k + 2 * w]));
    if (e < 3) flat++;
  }
  let bN = 0, bF = 0;
  for (let y = 0; y + 8 <= h; y += 8) for (let x = 0; x + 8 <= w; x += 8) {
    if (inHud(x, y, w, h)) continue; bN++;
    let s = 0, q = 0; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const l = L[(y + j) * w + x + i]; s += l; q += l * l; }
    const m = s / 64; const sd = Math.sqrt(Math.max(0, q / 64 - m * m)); if (sd < 2) bF++;
  }
  console.log((r.biome + '-' + r.tag).padEnd(18) + pad(am.toFixed(0), 5) + pad(rm.toFixed(0), 7) + pad((am - rm).toFixed(0), 5) + pad(asd.toFixed(0), 7) + pad(rsd.toFixed(0), 7) +
    ' |' + pad(ah.toFixed(0), 5) + pad(rh.toFixed(0), 5) + pad(dh.toFixed(0), 5) + ' |' + pad((100 * flat / n).toFixed(0), 8) + ' |' + pad((100 * bF / bN).toFixed(0), 8));
}
