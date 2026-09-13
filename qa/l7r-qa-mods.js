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
  const wrapped = await page.evaluate(() => {
    const g = window.__capy
    if (g.__l7m) return { again: true }
    g.__l7m = { mods: {}, step: 0, render: 0, tick: 0, frames: 0, on: false, shadowRender: 0, sceneRender: 0, renderCalls: 0 }
    const seen = new Set(); const names = []
    for (const k of Object.keys(g)) {
      const m = g[k]
      if (m && typeof m === 'object' && typeof m.update === 'function' && !seen.has(m)) {
        seen.add(m); const nm = m.__name || k; names.push(nm)
        const orig = m.update
        m.update = function (dt) { const t0 = performance.now(); try { return orig.call(this, dt) } finally { if (g.__l7m.on) g.__l7m.mods[nm] = (g.__l7m.mods[nm] || 0) + (performance.now() - t0) } }
      }
    }
    const ws = g.world.step
    g.world.step = function () { const t0 = performance.now(); try { return ws.apply(this, arguments) } finally { if (g.__l7m.on) g.__l7m.step += performance.now() - t0 } }
    const pr = g.post.render
    g.post.render = function () { const t0 = performance.now(); try { return pr.apply(this, arguments) } finally { if (g.__l7m.on) { g.__l7m.render += performance.now() - t0; g.__l7m.frames++ } } }
    const tk = g.tick
    g.tick = function () { const t0 = performance.now(); try { return tk.apply(this, arguments) } finally { if (g.__l7m.on) g.__l7m.tick += performance.now() - t0 } }
    // renderer.render itself, split by whether a shadow map pass is happening (three renders the shadow map inside render())
    const rr = g.renderer.render
    g.renderer.render = function (s, c) { const t0 = performance.now(); try { return rr.apply(this, arguments) } finally { if (g.__l7m.on) { g.__l7m.sceneRender += performance.now() - t0; g.__l7m.renderCalls++ } } }
    return { names }
  })
  const rows = []
  for (const n of ['venice', 'kowloon', 'sydney']) {
    await page.evaluate(async (name) => { const g = window.__capy; if (g.biome.current !== name) { g.hud.cross(name); await new Promise(r => setTimeout(r, 8000)) } }, n)
    for (const walking of [false, true]) {
      if (walking) await page.keyboard.down('KeyW')
      const r = await page.evaluate(async () => {
        const g = window.__capy, c = g.__l7m
        c.mods = {}; c.step = 0; c.render = 0; c.tick = 0; c.frames = 0; c.sceneRender = 0; c.renderCalls = 0; c.on = true
        const t0 = performance.now(); const gaps = []; let last = t0
        await new Promise(res => { const f = (t) => { gaps.push(t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
        c.on = false
        gaps.shift(); gaps.sort((a, b) => a - b)
        const f = Math.max(1, c.frames)
        const mods = {}; let total = 0
        for (const k in c.mods) { mods[k] = +(c.mods[k] / f).toFixed(2); total += c.mods[k] }
        const top = Object.entries(mods).sort((a, b) => b[1] - a[1]).slice(0, 8)
        return { frames: c.frames, p50: +gaps[gaps.length >> 1].toFixed(1), tickMs: +(c.tick / f).toFixed(2), stepMs: +(c.step / f).toFixed(2), renderMs: +(c.render / f).toFixed(2), sceneRenderMs: +(c.sceneRender / f).toFixed(2), renderCallsPerFrame: +(c.renderCalls / f).toFixed(1), modsMs: +(total / f).toFixed(2), top, other: +((c.tick - c.step - c.render - total) / f).toFixed(2), rung: g.state.perfRung, calls: g.state.perf.calls, tris: g.state.perf.triangles, npcs: g.npcs.length, props: g.props.length }
      })
      if (walking) await page.keyboard.up('KeyW')
      rows.push(Object.assign({ name: n, walking }, r))
    }
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-mods.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { wrapped, rows })
}
