// qa/l4r-art-crop.mjs — cut a region out of a frame and scale it up, so a
// detail (a decal edge, a penumbra, a face) can be read at its own size.
//   node qa/l4r-art-crop.mjs in.png x y w h scale out.png
import { pngRead } from './pnghist.mjs';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
const [IN, X, Y, W, H, S, OUT] = process.argv.slice(2);
const x0 = +X, y0 = +Y, w = +W, h = +H, s = +S || 1;
const a = pngRead(IN);
const ow = w * s, oh = h * s;
const raw = Buffer.alloc((ow * 3 + 1) * oh);
for (let y = 0; y < oh; y++) {
  raw[y * (ow * 3 + 1)] = 0;
  for (let x = 0; x < ow; x++) {
    const sx = x0 + Math.floor(x / s), sy = y0 + Math.floor(y / s);
    const i = (sy * a.w + sx) * a.chan, o = y * (ow * 3 + 1) + 1 + x * 3;
    raw[o] = a.data[i]; raw[o + 1] = a.data[i + 1]; raw[o + 2] = a.data[i + 2];
  }
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ow, 0); ihdr.writeUInt32BE(oh, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(OUT, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(OUT, ow + 'x' + oh);
