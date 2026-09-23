// Nearest-neighbour crop and enlarge of a screenshot: node qa/aaa-crop.mjs in out x y w h scale
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decodePng } from './aaa-stats.mjs';
const [inp, out, x, y, w, h, s = 3] = process.argv.slice(2).map((v, i) => i < 2 ? v : +v);
const A = decodePng(readFileSync(inp)), W = w * s, H = h * s, raw = Buffer.alloc(H * (W * 3 + 1));
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const si = ((y + Math.floor(j / s)) * A.w + x + Math.floor(i / s)) * A.bpp, di = j * (W * 3 + 1) + 1 + i * 3;
  raw[di] = A.px[si]; raw[di + 1] = A.px[si + 1]; raw[di + 2] = A.px[si + 2];
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const hdr = Buffer.alloc(13); hdr.writeUInt32BE(W, 0); hdr.writeUInt32BE(H, 4); hdr[8] = 8; hdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
