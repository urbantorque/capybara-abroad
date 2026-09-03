// HOW BIG IS THE CHANGE, IN THE FRAME? — a pixel A/B for the act light.
//
// `k` walking 0 -> 1 is a fact about a lerp. Whether six seconds of grade is
// something a player could see is a fact about the picture, and the only way to
// get it is to subtract two frames of the same station.
//
// Reports, per pair: the mean absolute per-channel delta over the whole frame,
// the mean signed delta (does it get darker or lighter), and the same two
// numbers over the corners only (the vignette is a corner term and a
// whole-frame mean hides it — the same reason the airlight sweep had to be
// probed where the lights are).
//
//   node qa/d7-diff.cjs qa/d7a-monaco-1.png qa/d7a-monaco-3.png
//
// PNG decoding by hand, because this repo has no dependencies and is not about
// to grow one for an A/B: 8-bit RGBA, non-interlaced, which is what
// page.screenshot writes.
const fs = require('fs');
const zlib = require('zlib');

function readPNG(path) {
  const b = fs.readFileSync(path);
  let p = 8, w = 0, h = 0, bitDepth = 0, colour = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    const data = b.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colour = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(path + ': bit depth ' + bitDepth);
  const ch = colour === 6 ? 4 : colour === 2 ? 3 : 0;
  if (!ch) throw new Error(path + ': colour type ' + colour);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * ch);
  const stride = w * ch;
  let q = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[q++];
    const line = raw.slice(q, q + stride); q += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const bb = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += bb;
      else if (filter === 3) v += (a + bb) >> 1;
      else if (filter === 4) {
        const pp = a + bb - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w: w, h: h, ch: ch, d: out };
}

const A = readPNG(process.argv[2]);
const B = readPNG(process.argv[3]);
if (A.w !== B.w || A.h !== B.h) throw new Error('size mismatch');
// The HUD is the top-left card and the bottom-right minimap, and neither is
// graded — a card that changed its own text between the two frames would
// otherwise be most of the answer.
const HUD_X = 310, HUD_Y = 210, MAP_X = 1090, MAP_Y = 570;
let n = 0, sumAbs = 0, sumSign = 0;
let cn = 0, cAbs = 0, cSign = 0;
const cornerR = Math.min(A.w, A.h) * 0.32;
for (let y = 0; y < A.h; y++) {
  for (let x = 0; x < A.w; x++) {
    if (x < HUD_X && y < HUD_Y) continue;
    if (x > MAP_X && y > MAP_Y) continue;
    const i = (y * A.w + x) * A.ch;
    for (let c = 0; c < 3; c++) {
      const d = B.d[i + c] - A.d[i + c];
      sumAbs += Math.abs(d); sumSign += d; n++;
    }
    // corners: outside a disc of 0.32 of the short side, centred
    const dx = (x - A.w / 2) / (A.w / 2), dy = (y - A.h / 2) / (A.h / 2);
    if (dx * dx + dy * dy > 0.55) {
      for (let c = 0; c < 3; c++) {
        const d = B.d[i + c] - A.d[i + c];
        cAbs += Math.abs(d); cSign += d; cn++;
      }
    }
  }
}
console.log(process.argv[2].split(/[\\/]/).pop() + ' -> ' + process.argv[3].split(/[\\/]/).pop());
console.log('  frame   |delta| ' + (sumAbs / n).toFixed(2) + '   signed ' + (sumSign / n).toFixed(2) + '   of 255');
console.log('  corners |delta| ' + (cAbs / cn).toFixed(2) + '   signed ' + (cSign / cn).toFixed(2));
