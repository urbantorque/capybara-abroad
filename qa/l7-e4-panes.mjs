// qa/l7-e4-panes.mjs — the luma sd inside every lit pane in Kowloon's rest frame
// (L7, E4 / art #6), off qa/l7-e4-panes.js's sample grids.
//   node qa/l7-e4-panes.mjs [qa/l7-e4-panes.json.png]
import { readFileSync } from 'node:fs';
import { pngRead } from './pnghist.mjs';
const jf = process.argv[2] || 'qa/l7-e4-panes.json.png';
const j = JSON.parse(readFileSync(jf, 'utf8'));
const img = pngRead(jf.replace('.json.png', '-hk.png'));
const { w, h, chan, data } = img;
const pad = (s, n) => String(s).padStart(n);
console.log('kowloon panes: boxes ' + j.hk.boxes + ' panes ' + j.hk.panes + ' in frame ' + j.hk.inFrame + '  cam ' + JSON.stringify(j.hk.cam) + '  err ' + j.hk.err);
console.log('pane at'.padEnd(22) + ' dist  hpx   n   mean    sd');
let n = 0, ok = 0, sdSum = 0;
for (const r of j.hk.rows) {
  const L = [];
  for (const [x, y] of r.pts) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = (y * w + x) * chan;
    L.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
  }
  if (L.length < 20) continue;
  const m = L.reduce((p, q) => p + q, 0) / L.length;
  const sd = Math.sqrt(L.reduce((p, q) => p + (q - m) * (q - m), 0) / L.length);
  n++; if (sd >= 12) ok++; sdSum += sd;
  console.log(r.at.join(',').padEnd(22) + pad(r.dist, 5) + pad(r.hpx, 5) + pad(L.length, 4) + pad(m.toFixed(0), 7) + pad(sd.toFixed(1), 6));
}
console.log('panes with sd ≥ 12: ' + ok + '/' + n + '   mean sd ' + (n ? (sdSum / n).toFixed(1) : '-'));
