// qa/pnghist.mjs — frame statistics from a PNG on disk, with no dependencies.
//
// The repo has none and is not going to acquire any, and every previous attempt
// to get a histogram out of the game has gone through the canvas — which comes
// back black, because the renderer has no preserveDrawingBuffer and the read is
// never in the same JS turn as the draw. That trap is recorded twice in the QA
// notes and it has cost hours both times.
//
// A screenshot is already a raster PNG. Node has zlib. So: parse IHDR, inflate
// IDAT, undo the five scanline filters, and the pixels are simply there.
//
//   node qa/pnghist.mjs qa/shot.png [more.png ...]
//
// Reports luma percentiles (is the picture washed?), the spread and IQR (is
// there any contrast?) and chroma (is there any colour?). The HUD panels are
// excluded: they are opaque paper in two fixed corners and they would otherwise
// put a bright, colourless block into every frame's statistics.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function pngRead(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(path + ': not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9];
      if (depth !== 8) throw new Error(path + ': only 8-bit is supported, got ' + depth);
      if (data[12] !== 0) throw new Error(path + ': interlaced PNGs are not supported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const chan = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 0 ? 1 : ctype === 4 ? 2 : 0;
  if (!chan) throw new Error(path + ': unsupported colour type ' + ctype);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * chan;
  const out = Buffer.alloc(h * stride);
  // The five filters, per the spec. `a` is the pixel to the left, `b` above,
  // `c` above-left, all zero off the edges.
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, y * stride + stride);
    const prev = y ? out.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    for (let i = 0; i < stride; i++) {
      const x = line[i];
      const a = i >= chan ? cur[i - chan] : 0;
      const b = prev ? prev[i] : 0;
      const c = (prev && i >= chan) ? prev[i - chan] : 0;
      let v;
      if (ft === 0) v = x;
      else if (ft === 1) v = x + a;
      else if (ft === 2) v = x + b;
      else if (ft === 3) v = x + ((a + b) >> 1);
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(path + ': bad filter ' + ft + ' on row ' + y);
      cur[i] = v & 255;
    }
  }
  return { w, h, chan, data: out };
}

// The to-do card sits top-left and the minimap bottom-right, both opaque. They
// are UI, not picture, and including them lifts every frame's p95 and flattens
// its chroma by the same amount in every chapter — which is worse than useless,
// because it is a CONSTANT error that looks like a measurement.
function inHud(x, y, w, h) {
  if (x < w * 0.24 && y < h * 0.40) return true;         // the paper
  if (x > w * 0.84 && y > h * 0.73) return true;         // the map
  return false;
}

export function pngStats(path) {
  const { w, h, chan, data } = pngRead(path);
  const luma = [], chroma = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (inHud(x, y, w, h)) continue;
      const i = y * w * chan + x * chan;
      const r = data[i], g = chan >= 3 ? data[i + 1] : data[i], b = chan >= 3 ? data[i + 2] : data[i];
      luma.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
      chroma.push(Math.max(r, g, b) - Math.min(r, g, b));
    }
  }
  luma.sort((a, b) => a - b);
  chroma.sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.floor((arr.length - 1) * p)];
  const st = {
    n: luma.length,
    p05: +q(luma, 0.05).toFixed(1), p25: +q(luma, 0.25).toFixed(1),
    p50: +q(luma, 0.50).toFixed(1), p75: +q(luma, 0.75).toFixed(1),
    p95: +q(luma, 0.95).toFixed(1),
    chr50: +q(chroma, 0.50).toFixed(1), chr90: +q(chroma, 0.90).toFixed(1),
    // fraction of the frame carrying any colour worth the name
    chrPct: +(100 * chroma.filter(c => c > 18).length / chroma.length).toFixed(1),
  };
  st.spread = +(st.p95 - st.p05).toFixed(1);
  st.iqr = +(st.p75 - st.p25).toFixed(1);
  return st;
}

if (process.argv[1] && process.argv[1].endsWith('pnghist.mjs')) {
  const files = process.argv.slice(2);
  console.log('file'.padEnd(34) + '  p05  p25  p50  p75  p95  sprd   iqr | chr50 chr90 chr%');
  for (const f of files) {
    try {
      const s = pngStats(f);
      console.log(f.split(/[\\/]/).pop().padEnd(34) +
        String(s.p05).padStart(5) + String(s.p25).padStart(5) + String(s.p50).padStart(5) +
        String(s.p75).padStart(5) + String(s.p95).padStart(5) + String(s.spread).padStart(6) +
        String(s.iqr).padStart(6) + ' |' + String(s.chr50).padStart(6) +
        String(s.chr90).padStart(6) + String(s.chrPct).padStart(6));
    } catch (e) { console.log(f + '  -- ' + e.message); }
  }
}
