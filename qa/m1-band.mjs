// qa/m1-band.mjs — WHAT DID THE CLOUD LAYER ACTUALLY PUT IN THE PICTURE?
//
// A frame histogram cannot resolve a small LIGHTING term (L3 proved that: two
// runs walk the animal to slightly different places and the framing delta
// swamps it). It can resolve a SKY term, and only because of one property this
// probe depends on: the on/off pair is taken from the SAME STANDING FRAME,
// seven hundred milliseconds apart, with nothing moving but the cloud layer's
// own visibility. Every pixel that differs is a cloud.
//
//   node qa/m1-band.mjs qa/m1ab-manly
//
// ...reads `-on.png` and `-off.png` and reports, over the top BAND of the
// frame: how much of it the layer covers at all, and how far it moves the
// pixels it covers. Coverage is the honest number — a mean over the whole band
// hides a strong cloud in a mostly empty sky.
import { pngRead } from './pnghist.mjs';

const BAND = 0.34;      // top third-ish: the horizon sits 28% down at rest
const HUD_W = 0.25;     // the paper is a fixed opaque block in the top left
const HUD_H = 0.46;
const HIT = Number(process.env.HIT || 3);          // 8-bit levels: below this is dither, not a cloud

function band(tag) {
  const on = pngRead(tag + '-on.png');
  const off = pngRead(tag + '-off.png');
  if (on.w !== off.w || on.h !== off.h || on.chan !== off.chan) throw new Error(tag + ': size mismatch');
  const ch = on.chan;
  const rows = Math.round(on.h * BAND);
  const hudW = Math.round(on.w * HUD_W), hudH = Math.round(on.h * HUD_H);
  let n = 0, hit = 0, sum = 0, peak = 0, sOn = 0, sOff = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < on.w; x++) {
      if (x < hudW && y < hudH) continue;          // the to-do card
      const i = (y * on.w + x) * ch;
      const lo = 0.2126 * on.data[i] + 0.7152 * on.data[i + 1] + 0.0722 * on.data[i + 2];
      const lf = 0.2126 * off.data[i] + 0.7152 * off.data[i + 1] + 0.0722 * off.data[i + 2];
      const d = Math.abs(lo - lf);
      n++; sOn += lo; sOff += lf;
      if (d >= HIT) { hit++; sum += d; if (d > peak) peak = d; }
    }
  }
  return { tag: tag.replace(/.*[\\/]/, ''), px: n,
           cover: +(100 * hit / n).toFixed(2),
           meanOnHit: hit ? +(sum / hit).toFixed(1) : 0,
           peak: +peak.toFixed(0),
           lumaOn: +(sOn / n).toFixed(1), lumaOff: +(sOff / n).toFixed(1) };
}

const args = process.argv.slice(2);
console.log('tag             cover%   dLuma  peak   band luma on/off');
for (const a of args) {
  const r = band(a);
  console.log(r.tag.padEnd(15),
              String(r.cover).padStart(6),
              String(r.meanOnHit).padStart(7),
              String(r.peak).padStart(5),
              '   ' + r.lumaOn + ' / ' + r.lumaOff);
}
