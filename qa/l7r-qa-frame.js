async page => {
  const st = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  if (!st) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-carry'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(4000)
  }
  await page.evaluate(() => {
    const g = window.__capy
    if (g.__l7cpu) return
    g.__l7cpu = { step: 0, render: 0, tick: 0, frames: 0, on: false, shadowPasses: 0 }
    const ws = g.world.step
    g.world.step = function () { const t0 = performance.now(); try { return ws.apply(this, arguments) } finally { if (g.__l7cpu.on) g.__l7cpu.step += performance.now() - t0 } }
    const pr = g.post.render
    g.post.render = function () { const t0 = performance.now(); try { return pr.apply(this, arguments) } finally { if (g.__l7cpu.on) { g.__l7cpu.render += performance.now() - t0; g.__l7cpu.frames++ } } }
    const tk = g.tick
    g.tick = function () { const t0 = performance.now(); try { return tk.apply(this, arguments) } finally { if (g.__l7cpu.on) g.__l7cpu.tick += performance.now() - t0 } }
  })
  // the settings row: the perf mode setter lives behind the pause card; drive it through the range input
  const setMode = async (mode) => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(700)
    const r = await page.evaluate((m) => {
      const inp = document.querySelector('input[aria-label="performance"]')
      if (!inp) return { ok: false, why: 'no input' }
      inp.value = String(m)
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true, v: inp.value }
    }, mode)
    await page.waitForTimeout(400)
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200)
    return r
  }
  const names = ['venice', 'kowloon', 'goreme', 'hanoi', 'sydney', 'pasto']
  const rows = []
  for (const n of names) {
    await page.evaluate(async (name) => { const g = window.__capy; if (g.biome.current !== name) { g.hud.cross(name); await new Promise(r => setTimeout(r, 8000)) } }, n)
    const perMode = {}
    for (const [label, mode] of [['pretty', 1], ['fast', 2]]) {
      const set = await setMode(mode)
      await page.waitForTimeout(1500)
      await page.keyboard.down('KeyW')
      const r = await page.evaluate(async () => {
        const g = window.__capy, c = g.__l7cpu
        c.step = 0; c.render = 0; c.tick = 0; c.frames = 0; c.on = true
        const pm = performance.memory
        const t0 = performance.now(); const gaps = []; let last = t0
        let heapLast = pm ? pm.usedJSHeapSize : 0, allocBytes = 0, gcN = 0, gcGaps = []
        await new Promise(res => { const f = (t) => {
          const gap = t - last; gaps.push(gap); last = t
          if (pm) { const h = pm.usedJSHeapSize; const d = h - heapLast; if (d >= 0) allocBytes += d; else { gcN++; gcGaps.push(+gap.toFixed(0)) } heapLast = h }
          if (t - t0 < 8000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
        c.on = false
        gaps.shift(); const raw = gaps.slice(); gaps.sort((a, b) => a - b)
        const q = (u) => +gaps[Math.min(gaps.length - 1, Math.floor(u * gaps.length))].toFixed(1)
        const f = Math.max(1, c.frames)
        const secs = (performance.now() - t0) / 1000
        return { frames: gaps.length, fps: +(gaps.length / secs).toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +gaps[gaps.length - 1].toFixed(0),
          tickMs: +(c.tick / f).toFixed(2), stepMs: +(c.step / f).toFixed(2), renderMs: +(c.render / f).toFixed(2),
          rung: g.state.perfRung, dpr: +g.renderer.getPixelRatio().toFixed(2), size: [g.renderer.domElement.width, g.renderer.domElement.height], shadow: g.perfAudit().shadow, mode: g.perfAudit().mode,
          calls: g.state.perf.calls, tris: g.state.perf.triangles,
          allocMBps: +(allocBytes / 1048576 / secs).toFixed(2), gcPerS: +(gcN / secs).toFixed(2), gcGapMed: gcGaps.length ? gcGaps.sort((a, b) => a - b)[gcGaps.length >> 1] : null, gcGapMax: gcGaps.length ? Math.max.apply(null, gcGaps) : null,
          heapMB: pm ? +(pm.usedJSHeapSize / 1048576).toFixed(0) : null, lastError: g.state.lastError || null }
      })
      await page.keyboard.up('KeyW')
      perMode[label] = Object.assign({ set }, r)
    }
    rows.push({ name: n, pretty: perMode.pretty, fast: perMode.fast })
  }
  await setMode(0)
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-frame.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { rows })
}
