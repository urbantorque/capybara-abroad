// Mean RGB of a PNG, over a rectangle, with no image library. Used to put a
// number on "does the bloom actually change the frame".
import fs from 'fs';
import zlib from 'zlib';

function decode(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('bit depth ' + bd);
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : ct === 4 ? 2 : -1;
  if (ch < 0) throw new Error('colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.slice(q, q + stride); q += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, px: out };
}

function stats(img, x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * img.w + x) * img.ch;
    r += img.px[i]; g += img.px[i + 1]; b += img.px[i + 2]; n++;
  }
  return { r: +(r / n).toFixed(2), g: +(g / n).toFixed(2), b: +(b / n).toFixed(2), n };
}

const [fa, fb] = process.argv.slice(2);
const A = decode(fa), B = decode(fb);
// skip the to-do card (top-left) and the minimap (bottom-right)
const box = [330, 0, 1080, 700];
const sa = stats(A, ...box), sb = stats(B, ...box);
console.log(fa, JSON.stringify(sa));
console.log(fb, JSON.stringify(sb));
console.log('delta', { r: +(sb.r - sa.r).toFixed(2), g: +(sb.g - sa.g).toFixed(2), b: +(sb.b - sa.b).toFixed(2) });
// per-pixel max abs difference and how many pixels moved by more than 8/255
let big = 0, maxd = 0, sum = 0;
for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
  const i = (y * A.w + x) * A.ch;
  const d = Math.max(Math.abs(A.px[i] - B.px[i]), Math.abs(A.px[i + 1] - B.px[i + 1]), Math.abs(A.px[i + 2] - B.px[i + 2]));
  if (d > 8) big++; if (d > maxd) maxd = d; sum += d;
}
const n = (box[2] - box[0]) * (box[3] - box[1]);
console.log('pixels changed >8/255:', big, '(' + (100 * big / n).toFixed(1) + '%)  max', maxd, ' mean', (sum / n).toFixed(2));
