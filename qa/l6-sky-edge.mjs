// qa/l6-sky-edge.mjs — the cloud-edge step (L6, E6 / art #5).
// For each pixel in the top TOP fraction of the frame (outside the HUD), the
// luma step across 4 px horizontally. A hard low-poly silhouette is a step of
// 60+ in four pixels; a soft one is under 30. Reports the p99 and max of the
// step and the share of pixels whose step is over 30 / 60.
//   node qa/l6-sky-edge.mjs [--top=0.26] qa/*.png
import { pngRead } from './pnghist.mjs';
let TOP = 0.26;
const files = [];
for (const a of process.argv.slice(2)) { if (a.startsWith('--top=')) TOP = +a.slice(6); else files.push(a); }
function inHud(x, y, w, h) { return (x < w * 0.24 && y < h * 0.47) || (x > w * 0.84 && y > h * 0.73); }
console.log('frame'.padEnd(30) + ' p99  max  >30%  >60%   n');
for (const f of files) {
  const { w, h, chan, data } = pngRead(f);
  const L = (x, y) => { const i = (y * w + x) * chan; return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; };
  const steps = []; let o30 = 0, o60 = 0;
  for (let y = 2; y < h * TOP; y += 1) for (let x = 2; x < w - 6; x += 1) {
    if (inHud(x, y, w, h)) continue;
    const s = Math.abs(L(x + 4, y) - L(x, y));
    steps.push(s); if (s > 30) o30++; if (s > 60) o60++;
  }
  steps.sort((a, b) => a - b);
  const n = steps.length;
  console.log(f.split(/[\/]/).pop().padEnd(30) + String(steps[Math.floor(n * 0.99)].toFixed(0)).padStart(4) +
    String(steps[n - 1].toFixed(0)).padStart(5) + String((100 * o30 / n).toFixed(2)).padStart(7) + String((100 * o60 / n).toFixed(2)).padStart(6) + String(n).padStart(8));
}
