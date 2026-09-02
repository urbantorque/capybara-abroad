async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0',
                'Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote','Comma','Period','Slash']
  await page.setViewportSize({ width: 1280, height: 720 })
  const out = []
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  for (let i = 0; i < 19; i++) {
    try {
      await page.goto('http://localhost:5188/')
      await page.waitForTimeout(5200)
      await page.keyboard.press(KEYS[i])
      await page.waitForTimeout(4200)
      await page.waitForTimeout(7000)

      const row = await page.evaluate(() => {
        const g = window.__capy
        const r = g.renderer
        const cv = r.domElement
        const gl = r.getContext()
        const W = cv.width, H = cv.height
        const x0 = Math.round(W * 0.20), x1 = Math.round(W * 0.86)
        const y0 = Math.round(H * 0.10), y1 = Math.round(H * 0.92)
        const w = x1 - x0, h = y1 - y0
        const buf = new Uint8Array(w * h * 4)
        g.tick(1 / 600, true)
        gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)

        const hist = new Float64Array(256)
        let n = 0, sum = 0, sum2 = 0
        for (let p = 0; p < w * h; p += 3) {
          const o = p * 4
          const L = 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2]
          hist[Math.max(0, Math.min(255, Math.round(L)))]++
          n++; sum += L; sum2 += L * L
        }
        const mean = sum / n
        const rms = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
        function pct(f) {
          const want = n * f
          let acc = 0
          for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= want) return v }
          return 255
        }
        const p01 = pct(0.01), p05 = pct(0.05), p50 = pct(0.50), p95 = pct(0.95), p99 = pct(0.99)
        return {
          biome: g.biome.current, n: n,
          mean: mean, rms: rms,
          p01: p01, p05: p05, p50: p50, p95: p95, p99: p99,
          span90: p95 - p05, span98: p99 - p01,
          michelson: (p95 + p05) > 0 ? (p95 - p05) / (p95 + p05) : 0
        }
      })
      out.push(row)
    } catch (err) {
      out.push({ i: i, error: String(err && err.message || err) })
    }
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p1-veil.json', { method: 'POST', body: s })
  }, { rows: out, errs: errs })
}
