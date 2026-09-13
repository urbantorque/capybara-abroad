// qa/l6-e6-lamps.mjs — the emitters' instrument (L6, E6 / art #7), read off
// the frames qa/l6-e6-lamps.js took and the projections it recorded.
//   Kowloon: for every car in front of the lens and within 30 m, the number
//            of clusters of pixels over luma 230 in the window UNDER it
//            (five metres each side and below, at its distance; a bit above
//            for the roof sign) — a lamp, its pool or its streak.
//   Iceland: for every street-facing window pool in front and within 30 m,
//            the luma at its centre against the pavement 5 m along the
//            street (the darker of +5 / -5, so a neighbour's pool does not
//            count as "away"). Reports the median of the difference.
//   Monaco:  clusters over 230 inside the cabin's screen box.
//   node qa/l6-e6-lamps.mjs
import { pngRead } from './pnghist.mjs';
import { readFileSync } from 'node:fs';
const J = JSON.parse(readFileSync('qa/l6-e6-lamps.json.png', 'utf8'));
function inHud(x, y, w, h) { return (x < w * 0.24 && y < h * 0.47) || (x > w * 0.84 && y > h * 0.73); }
function lumaMap(f) {
  const { w, h, chan, data } = pngRead(f);
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = 0.2126 * data[i * chan] + 0.7152 * data[i * chan + 1] + 0.0722 * data[i * chan + 2];
  return { w, h, L };
}
function clusters(M, x0, y0, x1, y1, thr, minPx) {
  const { w, h, L } = M;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
  const seen = new Uint8Array(w * h); let n = 0, best = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * w + x;
    if (seen[k] || L[k] <= thr || inHud(x, y, w, h)) continue;
    let size = 0; const st = [k]; seen[k] = 1;
    while (st.length) {
      const q = st.pop(); size++;
      const qx = q % w, qy = (q - qx) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const nk = ny * w + nx;
        if (seen[nk] || L[nk] <= thr) continue;
        seen[nk] = 1; st.push(nk);
      }
    }
    if (size >= minPx) { n++; if (size > best) best = size; }
  }
  return { n, best };
}
function mean(M, x, y, r) { let s = 0, n = 0; for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) { if (xx < 0 || yy < 0 || xx >= M.w || yy >= M.h) continue; s += M.L[yy * M.w + xx]; n++; } return n ? s / n : NaN; }
const on = (p, M) => p.front && p.sx >= 0 && p.sx < M.w && p.sy >= 0 && p.sy < M.h && !inHud(p.sx, p.sy, M.w, M.h);
for (const s of J.shots) {
  const f = 'qa/l6-e6-lamps-' + s.shot + '.png';
  const M = lumaMap(f);
  console.log('== ' + s.shot + '  err=' + s.err + '  cam ' + s.cam.join(','));
  if (s.shot.startsWith('kowloon')) {
    const cars = s.named.filter(n => n.name === 'hkTaxi').concat(s.parked || []);
    for (const c of cars) {
      if (!(c.front && c.d <= 30 && c.sx > -100 && c.sx < M.w + 100 && c.sy > -100 && c.sy < M.h)) { console.log('   ' + c.name.padEnd(9) + ' d ' + c.d + ' — not in frame / over 30 m'); continue; }
      const hw = Math.round(5 * 640 / (Math.tan(24 * Math.PI / 180) * c.d)), hh = Math.round(hw * 0.4); const r = clusters(M, c.sx - hw, c.sy - hh, c.sx + hw, c.sy + hw, 230, 6);
      console.log('   ' + c.name.padEnd(9) + ' d ' + String(c.d).padStart(5) + ' at ' + c.sx + ',' + c.sy + ': clusters>230 under it ' + r.n + ' (largest ' + r.best + ' px)');
    }
  }
  if (s.shot.startsWith('iceland')) {
    const diffs = [];
    for (const p of s.pools || []) {
      if (!(on(p.at, M) && p.at.d <= 30)) continue;
      if (!(on(p.plus, M) || on(p.minus, M))) continue;
      const under = mean(M, p.at.sx, p.at.sy, 3);
      const aw = [p.plus, p.minus].filter(q => on(q, M)).map(q => mean(M, q.sx, q.sy, 3));
      const away = Math.min(...aw);
      diffs.push({ d: p.at.d, under: +under.toFixed(0), away: +away.toFixed(0), diff: +(under - away).toFixed(0) });
    }
    diffs.sort((a, b) => a.diff - b.diff);
    const med = diffs.length ? diffs[Math.floor(diffs.length / 2)].diff : NaN;
    console.log('   window pools in frame within 30 m: ' + diffs.length + '  median(under - 5 m away) = ' + med +
      '  over +15: ' + diffs.filter(d => d.diff >= 15).length);
    for (const d of diffs.slice(0, 3).concat(diffs.slice(-3))) console.log('      d ' + d.d + ': under ' + d.under + ' away ' + d.away + ' diff ' + d.diff);
    const car = s.named.find(n => n.name === 'iceCar');
    if (car && car.front && car.d <= 30 && on(car, M)) {
      const hw = Math.round(5 * 640 / (Math.tan(24 * Math.PI / 180) * car.d)); const r = clusters(M, car.sx - hw, car.sy - Math.round(hw * 0.4), car.sx + hw, car.sy + hw, 230, 6);
      console.log('   iceCar d ' + car.d + ' at ' + car.sx + ',' + car.sy + ': clusters>230 under it ' + r.n + ' (largest ' + r.best + ' px)');
    }
  }
  if (s.shot.startsWith('monaco') && s.cabin) {
    const xs = s.cabin.map(p => p.sx), ys = s.cabin.map(p => p.sy);
    const r = clusters(M, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 230, 4);
    const y = s.named.find(n => n.name === 'monYacht');
    console.log('   yacht d ' + (y ? y.d : '?') + ' cabin box x ' + Math.min(...xs) + '..' + Math.max(...xs) + ' y ' + Math.min(...ys) + '..' + Math.max(...ys) + ': clusters>230 ' + r.n + ' (largest ' + r.best + ' px)');
  }
}
