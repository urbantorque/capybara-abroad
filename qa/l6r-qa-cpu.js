async page => {
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(500)
    const ok = await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))
    if (ok) break
  }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-carry'); if (b) b.click() })
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500)
    const s = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
    if (s) break
  }
  await page.waitForTimeout(4000)
  const wrapped = await page.evaluate(() => {
    const g = window.__capy
    if (!g.state.started) return { started: false }
    g.__cpu = { mods: {}, step: 0, render: 0, frames: 0, on: false }
    const seen = new Set()
    const names = []
    for (const k of Object.keys(g)) {
      const m = g[k]
      if (m && typeof m === 'object' && typeof m.update === 'function' && m.__name && !seen.has(m)) {
        seen.add(m)
        const nm = m.__name
        names.push(nm)
        const orig = m.update
        m.update = function (dt) {
          const t0 = performance.now()
          try { return orig.call(this, dt) } finally { if (g.__cpu.on) g.__cpu.mods[nm] = (g.__cpu.mods[nm] || 0) + (performance.now() - t0) }
        }
      }
    }
    const ws = g.world.step
    g.world.step = function () { const t0 = performance.now(); try { return ws.apply(this, arguments) } finally { if (g.__cpu.on) g.__cpu.step += performance.now() - t0 } }
    const pr = g.post.render
    g.post.render = function () { const t0 = performance.now(); try { return pr.apply(this, arguments) } finally { if (g.__cpu.on) { g.__cpu.render += performance.now() - t0; g.__cpu.frames++ } } }
    return { started: true, names }
  })
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const rows = []
  for (const n of names) {
    await page.evaluate((name) => window.__capy.hud.cross(name), n)
    await page.waitForTimeout(8000)
    await page.evaluate(() => { const c = window.__capy.__cpu; c.mods = {}; c.step = 0; c.render = 0; c.frames = 0; c.on = true })
    await page.waitForTimeout(5000)
    const r = await page.evaluate((name) => {
      const g = window.__capy, c = g.__cpu
      c.on = false
      const f = Math.max(1, c.frames)
      const mods = {}
      let modsTotal = 0
      for (const k in c.mods) { mods[k] = +(c.mods[k] / f).toFixed(2); modsTotal += c.mods[k] }
      const top = Object.entries(mods).sort((a, b) => b[1] - a[1]).slice(0, 6)
      return { biome: g.biome.current, ok: g.biome.current === name, frames: c.frames, stepMs: +(c.step / f).toFixed(2),
        renderMs: +(c.render / f).toFixed(2), modsMs: +(modsTotal / f).toFixed(2), top, calls: g.state.perf.calls,
        tris: g.state.perf.triangles, bodies: g.world.bodies.length, rung: g.perfAudit().rung, npcs: g.npcs ? g.npcs.length : -1,
        props: g.props.length, lastError: g.state.lastError || null }
    }, n)
    rows.push(r)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-cpu.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { wrapped, rows })
}
