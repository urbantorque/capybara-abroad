// qa/l7-e4-frame.mjs — THE SURFACE's picture metrics (L7, E4), one tool for
// the before and the after so the numbers are the same numbers:
//   flat8   share of 8×8 blocks (HUD excluded) whose luma sd < 2
//   range   luma p01–p99
//   edge    share of pixels whose 4-px luma edge ≥ 12 (a real edge, not grain)
//   >230    share of pixels over luma 230; p90/p99/max and the top decile's span
//   sky sd  luma sd of the band 2–10 % from the top of the frame (the dome)
//   node qa/l7-e4-frame.mjs qa/a.png [qa/b.png ...]
import { pngRead } from './pnghist.mjs';
function inHud(x, y, w, h) {
  if (x < w * 0.24 && y < h * 0.47) return true;
  if (x > w * 0.84 && y > h * 0.73) return true;
  return false;
}
const pad = (s, n) => String(s).padStart(n);
console.log('frame'.padEnd(34) + ' flat8%  p01  p99 range  edge%  >230%  p90  p99  max top10 | skySd');
for (const path of process.argv.slice(2)) {
  let img; try { img = pngRead(path); } catch (e) { console.log(path, e.message); continue; }
  const { w, h, chan, data } = img;
  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * chan;
    L[y * w + x] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  const hist = new Float64Array(256); let n = 0, over = 0, eN = 0, eK = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (inHud(x, y, w, h)) continue;
    const l = L[y * w + x]; hist[Math.min(255, Math.round(l))]++; n++; if (l > 230) over++;
    if (x >= 2 && x < w - 2 && y >= 2 && y < h - 2) {
      const k = y * w + x;
      const e = Math.max(Math.abs(l - L[k - 2]), Math.abs(l - L[k + 2]), Math.abs(l - L[k - 2 * w]), Math.abs(l - L[k + 2 * w]));
      eN++; if (e >= 12) eK++;
    }
  }
  const pct = (p) => { let c = 0; for (let i = 0; i < 256; i++) { c += hist[i]; if (c >= p * n) return i; } return 255; };
  let mx = 255; while (mx > 0 && hist[mx] === 0) mx--;
  let bN = 0, bF = 0;
  for (let y = 0; y + 8 <= h; y += 8) for (let x = 0; x + 8 <= w; x += 8) {
    if (inHud(x, y, w, h)) continue; bN++;
    let s = 0, q = 0; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const l = L[(y + j) * w + x + i]; s += l; q += l * l; }
    const m = s / 64; if (Math.sqrt(Math.max(0, q / 64 - m * m)) < 2) bF++;
  }
  let sS = 0, sQ = 0, sN = 0;
  for (let y = Math.floor(h * 0.02); y < h * 0.10; y++) for (let x = Math.floor(w * 0.3); x < w * 0.84; x++) { const l = L[y * w + x]; sS += l; sQ += l * l; sN++; }
  const sm = sS / sN, ssd = Math.sqrt(Math.max(0, sQ / sN - sm * sm));
  const p01 = pct(0.01), p99 = pct(0.99), p90 = pct(0.90);
  console.log(path.replace(/^qa\//, '').padEnd(34) + pad((100 * bF / bN).toFixed(0), 6) + pad(p01, 5) + pad(p99, 5) + pad(p99 - p01, 6) +
    pad((100 * eK / eN).toFixed(1), 7) + pad((100 * over / n).toFixed(1), 7) + pad(p90, 5) + pad(p99, 5) + pad(mx, 5) + pad(mx - p90, 6) + ' |' + pad(ssd.toFixed(1), 6));
}
