// AAA review: tone statistics of a screenshot, no dependencies. Decodes an
// 8-bit RGB/RGBA PNG (the only kind page.screenshot writes) and prints luma
// percentiles, the p2-p98 range, mean saturation and the local contrast
// (mean |luma - 5x5 box mean|, which is what "flat" means to an eye).
// Usage: node qa/aaa-stats.mjs qa/a.png [qa/b.png ...]   [--x0=360 --x1=1060]
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8) throw new Error('8-bit only'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error('RGB/RGBA only');
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}

export function stats(file, x0 = 360, x1 = 1060, y0 = 0, y1 = 1e9) {
  const { w, h, bpp, px } = decodePng(readFileSync(file));
  x1 = Math.min(x1, w); y1 = Math.min(y1, h);
  const L = new Float32Array(w * h); let sat = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * bpp, r = px[i], g = px[i + 1], b = px[i + 2];
    L[y * w + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const vals = []; let lc = 0;
  for (let y = y0 + 2; y < y1 - 2; y += 2) for (let x = x0 + 2; x < x1 - 2; x += 2) {
    const i = (y * w + x) * bpp, r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx) sat += (mx - mn) / mx;
    vals.push(L[y * w + x]); n++;
    let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m += L[(y + dy) * w + x + dx];
    lc += Math.abs(L[y * w + x] - m / 25);
  }
  vals.sort((a, b) => a - b); const q = f => Math.round(vals[Math.floor(f * (vals.length - 1))]);
  return { p2: q(0.02), p10: q(0.1), p50: q(0.5), p90: q(0.9), p98: q(0.98), range: q(0.98) - q(0.02),
    sat: +(sat / n).toFixed(3), local: +(lc / n).toFixed(2) };
}

if (process.argv[1].endsWith('aaa-stats.mjs') && process.argv[2] !== '--diff') {
  const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')).map(([k, v]) => [k, +v]));
  for (const f of args.filter(a => !a.startsWith('--'))) {
    const s = stats(f, opt.x0, opt.x1, opt.y0, opt.y1);
    console.log(f.replace(/.*[\\/]/, '').padEnd(28), Object.entries(s).map(([k, v]) => k + '=' + v).join(' '));
  }
}

// Amplified difference of two same-size screenshots, written as a greyscale
// PNG (x8, so one level of change reads as eight): where a term acts.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
export function writeGrey(file, w, h, g) {
  const raw = Buffer.alloc(h * (w + 1)); for (let y = 0; y < h; y++) g.copy(raw, y * (w + 1) + 1, y * w, y * w + w);
  const hdr = Buffer.alloc(13); hdr.writeUInt32BE(w, 0); hdr.writeUInt32BE(h, 4); hdr[8] = 8; hdr[9] = 0;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
export function diff(a, b, out, gain = 8) {
  const A = decodePng(readFileSync(a)), B = decodePng(readFileSync(b)), g = Buffer.alloc(A.w * A.h);
  let sum = 0, dark = 0;
  for (let i = 0; i < A.w * A.h; i++) {
    const la = 0.2126 * A.px[i * A.bpp] + 0.7152 * A.px[i * A.bpp + 1] + 0.0722 * A.px[i * A.bpp + 2];
    const lb = 0.2126 * B.px[i * B.bpp] + 0.7152 * B.px[i * B.bpp + 1] + 0.0722 * B.px[i * B.bpp + 2];
    const d = la - lb; sum += Math.abs(d); if (d > 4) dark++;
    g[i] = Math.min(255, Math.abs(d) * gain);
  }
  writeGrey(out, A.w, A.h, g);
  return { meanAbs: +(sum / (A.w * A.h)).toFixed(2), darkerBy4Pct: +(100 * dark / (A.w * A.h)).toFixed(1) };
}
if (process.argv[2] === '--diff') console.log(diff(process.argv[3], process.argv[4], process.argv[5], +(process.argv[6] || 8)));
