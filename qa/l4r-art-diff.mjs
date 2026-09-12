// qa/l4r-art-diff.mjs — where two frames differ, and by how much.
//   node qa/l4r-art-diff.mjs a.png b.png [out.png]
// Prints the share of pixels that moved (> 3 levels of luma), the mean move
// over those, the peak, and the mean over the whole frame; optionally writes
// a greyscale PNG of |a - b| × 3 so the shadow (or whatever term) can be SEEN.
import { pngRead } from './pnghist.mjs';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function pngWriteGrey(path, w, h, g) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; g.subarray(y * w, (y + 1) * w).forEach((v, x) => { raw[y * (w + 1) + 1 + x] = v; }); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const [A, B, OUT] = process.argv.slice(2);
const a = pngRead(A), b = pngRead(B);
if (a.w !== b.w || a.h !== b.h) throw new Error('size mismatch');
const w = a.w, h = a.h, g = new Uint8Array(w * h);
let moved = 0, sumMoved = 0, sumAll = 0, peak = 0, n = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (y * w + x) * a.chan, j = (y * w + x) * b.chan;
  const la = 0.2126 * a.data[i] + 0.7152 * a.data[i + 1] + 0.0722 * a.data[i + 2];
  const lb = 0.2126 * b.data[j] + 0.7152 * b.data[j + 1] + 0.0722 * b.data[j + 2];
  const d = Math.abs(la - lb); n++; sumAll += d;
  if (d > 3) { moved++; sumMoved += d; }
  if (d > peak) peak = d;
  g[y * w + x] = Math.min(255, Math.round(d * 3));
}
console.log(JSON.stringify({ a: A.split(/[\\/]/).pop(), b: B.split(/[\\/]/).pop(), movedPct: +(100 * moved / n).toFixed(1), meanMoved: +(sumMoved / Math.max(1, moved)).toFixed(1), meanAll: +(sumAll / n).toFixed(2), peak: +peak.toFixed(0) }));
if (OUT) pngWriteGrey(OUT, w, h, g);
