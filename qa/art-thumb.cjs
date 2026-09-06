// CROP AND SHRINK A SCREENSHOT, for a review sheet.
//
//   node qa/art-thumb.cjs in.png out.png fx fy fw fh targetW
//
// fx fy fw fh are FRACTIONS of the source frame, because the raw renders come
// off the canvas at whatever size the adaptive scaler had it (896, 1023 or
// 1280 wide on the same day) and a crop in pixels would land somewhere else on
// each. Box-filtered, unlike crop.cjs, because this one is for looking at a
// picture rather than at geometry.
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
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colour = data[9]; }
    else if (type === 'IDAT') idat.push(data);
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
  return { w, h, ch, d: out };
}
let CRC = null;
function crc32(buf) {
  if (!CRC) {
    CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); CRC[n] = c; }
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
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

const [, , inp, outp, fxs, fys, fws, fhs, tws] = process.argv;
const A = readPNG(inp);
const x0 = Math.round(A.w * +fxs), y0 = Math.round(A.h * +fys);
const cw = Math.min(Math.round(A.w * +fws), A.w - x0), chh = Math.min(Math.round(A.h * +fhs), A.h - y0);
const div = Math.max(1, Math.round(cw / (+tws || 400)));
const ow = Math.floor(cw / div), oh = Math.floor(chh / div);
const rgb = Buffer.alloc(ow * oh * 3);
const n = div * div;
for (let y = 0; y < oh; y++) {
  for (let x = 0; x < ow; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < div; dy++) for (let dx = 0; dx < div; dx++) {
      const si = ((y0 + y * div + dy) * A.w + (x0 + x * div + dx)) * A.ch;
      r += A.d[si]; g += A.d[si + 1]; b += A.d[si + 2];
    }
    const di = (y * ow + x) * 3;
    rgb[di] = (r / n) | 0; rgb[di + 1] = (g / n) | 0; rgb[di + 2] = (b / n) | 0;
  }
}
writePNG(outp, ow, oh, rgb);
console.log(outp + '  ' + ow + 'x' + oh + '  (source ' + A.w + 'x' + A.h + ', /' + div + ')');
