// A contact sheet: screenshots downscaled (box filter) into one grid PNG.
//   node qa/aaa-sheet.mjs out.png cols scale a.png b.png ...
import { readFileSync } from 'node:fs';
import { decodePng } from './aaa-stats.mjs';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const [out, colsArg, scaleArg, ...files] = process.argv.slice(2);
const cols = +colsArg, k = +scaleArg;
const imgs = files.map(f => decodePng(readFileSync(f)));
const cw = Math.floor(imgs[0].w / k), ch = Math.floor(imgs[0].h / k), rows = Math.ceil(imgs.length / cols);
const W = cw * cols, H = ch * rows, raw = Buffer.alloc(H * (W * 3 + 1));
imgs.forEach((A, n) => {
  const ox = (n % cols) * cw, oy = Math.floor(n / cols) * ch;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
      const i = ((y * k + dy) * A.w + x * k + dx) * A.bpp; r += A.px[i]; g += A.px[i + 1]; b += A.px[i + 2];
    }
    const d = (oy + y) * (W * 3 + 1) + 1 + (ox + x) * 3, kk = k * k;
    raw[d] = r / kk; raw[d + 1] = g / kk; raw[d + 2] = b / kk;
  }
});
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = bb => { let c = -1; for (const v of bb) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, dd) => { const l = Buffer.alloc(4); l.writeUInt32BE(dd.length); const td = Buffer.concat([Buffer.from(t), dd]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const hdr = Buffer.alloc(13); hdr.writeUInt32BE(W, 0); hdr.writeUInt32BE(H, 4); hdr[8] = 8; hdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
