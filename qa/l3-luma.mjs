// qa/l3-luma.mjs — the frame in three bands, for THE FRAME HAS A DARK (L3, E1).
//
// The resting lens puts the sky at ~0% of the frame (memory: the second beauty
// pass), so "sky vs horizon" cannot be read off a screenshot. What CAN be
// read is the FAR FIELD: the top quarter of the picture is 27-200 m away
// (sysDEPTH's measured table) and the middle band is 12-18 m. A frame with no
// dark is one where the far band has converged on a pale value — high mean,
// low spread, low chroma — and where the frame's p05 never gets under ~0.3.
//
//   node qa/l3-luma.mjs qa/l3-*.png
//   node qa/l3-luma.mjs --json qa/l3-*.png     (one JSON line per file)
//
// Per band: mean luma (0-255), the standard deviation (is there any shape in
// it), and mean chroma. HUD corners excluded as pnghist does.
import { pngRead } from './pnghist.mjs';

function inHud(x, y, w, h) {
  if (x < w * 0.24 && y < h * 0.47) return true;
  if (x > w * 0.84 && y > h * 0.73) return true;
  return false;
}
export function bands(path) {
  const { w, h, chan, data } = pngRead(path);
  const B = [[0, 0.25], [0.25, 0.60], [0.60, 1.0]];
  const acc = B.map(() => ({ n: 0, s: 0, s2: 0, c: 0 }));
  const all = [];
  for (let y = 0; y < h; y += 2) {
    const bi = y < h * 0.25 ? 0 : y < h * 0.60 ? 1 : 2;
    for (let x = 0; x < w; x += 2) {
      if (inHud(x, y, w, h)) continue;
      const i = y * w * chan + x * chan;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const a = acc[bi];
      a.n++; a.s += l; a.s2 += l * l; a.c += Math.max(r, g, b) - Math.min(r, g, b);
      all.push(l);
    }
  }
  all.sort((p, q) => p - q);
  const q = p => all[Math.floor((all.length - 1) * p)];
  const row = { file: path.split(/[\\/]/).pop(), p05: +q(0.05).toFixed(0), p50: +q(0.5).toFixed(0), p95: +q(0.95).toFixed(0) };
  const names = ['far', 'mid', 'near'];
  acc.forEach((a, k) => {
    const m = a.s / a.n, sd = Math.sqrt(Math.max(0, a.s2 / a.n - m * m));
    row[names[k]] = { mean: +m.toFixed(0), sd: +sd.toFixed(0), chr: +(a.c / a.n).toFixed(0) };
  });
  return row;
}
const args = process.argv.slice(2);
const json = args[0] === '--json';
const files = json ? args.slice(1) : args;
if (!json) console.log('file'.padEnd(30) + ' p05 p50 p95 | far mean sd chr | mid mean sd chr | near mean sd chr');
for (const f of files) {
  try {
    const r = bands(f);
    if (json) console.log(JSON.stringify(r));
    else console.log(r.file.padEnd(30) + String(r.p05).padStart(4) + String(r.p50).padStart(4) + String(r.p95).padStart(4) +
      ' |' + String(r.far.mean).padStart(9) + String(r.far.sd).padStart(3) + String(r.far.chr).padStart(4) +
      ' |' + String(r.mid.mean).padStart(9) + String(r.mid.sd).padStart(3) + String(r.mid.chr).padStart(4) +
      ' |' + String(r.near.mean).padStart(10) + String(r.near.sd).padStart(3) + String(r.near.chr).padStart(4));
  } catch (e) { console.log(f + ' -- ' + e.message); }
}
