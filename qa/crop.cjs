// CROP AND MAGNIFY A SCREENSHOT — because some of this game is 2 cm across.
//
//   node qa/crop.cjs in.png out.png x y w h [scale]
//
// D8 put two 7 cm brow bars on a 37 cm skull and the only way to judge them is
// to look at them, and a 1280x760 frame of a whole park is not looking at them.
// Nearest-neighbour, deliberately: this is for inspecting geometry, and a
// smooth resample invents edges that are not in the render.
//
// No dependencies, like everything else in this repo: PNG in, PNG out, 8-bit
// non-interlaced, which is what page.screenshot writes.
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

let CRC = null;
function crc32(buf) {
  if (!CRC) {
    CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      CRC[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function writePNG(path, w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;                       // filter 0, none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

const [, , inp, outp, xs, ys, ws, hs, ss] = process.argv;
const A = readPNG(inp);
const x0 = Math.max(0, +xs | 0), y0 = Math.max(0, +ys | 0);
const cw = Math.min(+ws | 0, A.w - x0), chh = Math.min(+hs | 0, A.h - y0);
const sc = Math.max(1, (+ss || 4) | 0);
const ow = cw * sc, oh = chh * sc;
const rgb = Buffer.alloc(ow * oh * 3);
for (let y = 0; y < oh; y++) {
  const sy = y0 + ((y / sc) | 0);
  for (let x = 0; x < ow; x++) {
    const sx = x0 + ((x / sc) | 0);
    const si = (sy * A.w + sx) * A.ch, di = (y * ow + x) * 3;
    rgb[di] = A.d[si]; rgb[di + 1] = A.d[si + 1]; rgb[di + 2] = A.d[si + 2];
  }
}
writePNG(outp, ow, oh, rgb);
console.log(outp + '  ' + ow + 'x' + oh + '  (from ' + cw + 'x' + chh + ' at ' + x0 + ',' + y0 + ' x' + sc + ')');
