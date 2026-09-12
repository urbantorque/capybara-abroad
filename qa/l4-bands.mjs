// qa/l4-bands.mjs — the mean luma of three horizontal bands of a frame:
// the sky band (top 12 %), the middle, and the ground band (bottom 22 %),
// the two HUD corners excluded, every 2nd pixel. For E1's "the Monaco quay
// darker than its sky" and E7's sky-band contrast.
//
//   node qa/l4-bands.mjs qa/l4-*.png
import { pngRead } from './pnghist.mjs';

function band(path) {
  const { w, h, chan, data } = pngRead(path);
  const acc = [[0, 0], [0, 0], [0, 0]];
  const sd = [];
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    if (x < w * 0.24 && y < h * 0.47) continue;
    if (x > w * 0.84 && y > h * 0.73) continue;
    if (x > w * 0.30 && x < w * 0.70 && y > h * 0.76) continue;   // the toast strip
    const i = (y * w + x) * chan;
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const b = y < h * 0.12 ? 0 : y > h * 0.78 ? 2 : 1;
    acc[b][0] += l; acc[b][1]++;
    if (b === 0) sd.push(l);
  }
  const m = acc.map(a => a[1] ? a[0] / a[1] : 0);
  const mean = m[0];
  let v = 0; for (const l of sd) v += (l - mean) * (l - mean);
  return { sky: m[0], mid: m[1], ground: m[2], skySd: Math.sqrt(v / Math.max(1, sd.length)) };
}
console.log('frame'.padEnd(26) + '  sky   mid  ground  skySd');
for (const p of process.argv.slice(2)) {
  const b = band(p);
  const name = p.replace(/^.*[\\/]/, '').replace(/\.png$/, '');
  console.log(name.padEnd(26) + ' ' + b.sky.toFixed(0).padStart(4) + ' ' + b.mid.toFixed(0).padStart(5) + ' ' + b.ground.toFixed(0).padStart(6) + ' ' + b.skySd.toFixed(1).padStart(6));
}
