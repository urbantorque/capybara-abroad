// Contrast ratio of rendered text, straight off a PNG. No dependencies.
// Reuses the decoder from qa/b4pal-px.mjs.
import fs from 'fs'
import zlib from 'zlib'

function decode(file) {
  const buf = fs.readFileSync(file)
  let p = 8, w = 0, h = 0, bd = 0, ct = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.slice(p + 8, p + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9] }
    else if (type === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : ct === 4 ? 2 : -1
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(h * stride)
  let q = 0
  for (let y = 0; y < h; y++) {
    const f = raw[q++]
    const line = raw.slice(q, q + stride); q += stride
    const cur = out.slice(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0
      let v = line[i]
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c) }
      cur[i] = v & 255
    }
  }
  return { w, h, ch, px: out }
}
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

function box(img, x0, y0, x1, y1) {
  const arr = []
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * img.w + x) * img.ch
    arr.push([L(img.px[i], img.px[i + 1], img.px[i + 2]), img.px[i], img.px[i + 1], img.px[i + 2]])
  }
  arr.sort((a, b) => a[0] - b[0])
  const lo = arr[Math.floor(arr.length * 0.03)]      // darkest ink, past the stray
  const hi = arr[Math.floor(arr.length * 0.95)]      // the paper
  const cr = (Math.max(lo[0], hi[0]) + 0.05) / (Math.min(lo[0], hi[0]) + 0.05)
  return { ink: [lo[1], lo[2], lo[3]], paper: [hi[1], hi[2], hi[3]], ratio: +cr.toFixed(2) }
}

const file = process.argv[2]
const img = decode(file)
for (const spec of process.argv.slice(3)) {
  const [name, x0, y0, x1, y1] = spec.split(',')
  const r = box(img, +x0, +y0, +x1, +y1)
  console.log(name.padEnd(22), 'ratio', String(r.ratio).padStart(6), ' ink rgb(' + r.ink.join(',') + ')  bg rgb(' + r.paper.join(',') + ')')
}
