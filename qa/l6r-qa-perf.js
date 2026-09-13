async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  const t0goto = Date.now()
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const boot = await page.evaluate(() => {
    const g = window.__capy
    const gl = g.renderer.getContext()
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return { started: !!(g && g.state.started), ua: navigator.userAgent,
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
      dpr: window.devicePixelRatio, size: [innerWidth, innerHeight],
      perf: g.perfAudit ? g.perfAudit() : null, mem: JSON.parse(JSON.stringify(g.renderer.info.memory)) }
  })
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const rows = []
  const sample = async (label) => {
    await page.evaluate(() => {
      const g = window.__capy
      g.__l6 = { ts: [], calls: [], tris: [] }
      const f = (t) => {
        g.__l6.ts.push(t)
        g.__l6.calls.push(g.state.perf.calls)
        g.__l6.tris.push(g.state.perf.triangles)
        if (g.__l6.ts.length < 152) requestAnimationFrame(f)
        else g.__l6.done = true
      }
      requestAnimationFrame(f)
    })
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500)
      const done = await page.evaluate(() => !!(window.__capy.__l6 && window.__capy.__l6.done))
      if (done) break
    }
    return page.evaluate((label) => {
      const g = window.__capy, s = g.__l6
      const d = []
      for (let i = 1; i < s.ts.length; i++) d.push(s.ts[i] - s.ts[i - 1])
      d.sort((a, b) => a - b)
      const q = p => d.length ? +d[Math.min(d.length - 1, Math.floor(p * d.length))].toFixed(1) : null
      const med = arr => { const a = arr.slice().sort((x, y) => x - y); return a[a.length >> 1] }
      return { label, n: d.length, med: q(0.5), p95: q(0.95), max: q(0.999),
        calls: med(s.calls), tris: med(s.tris), done: !!s.done }
    }, label)
  }
  for (const n of names) {
    const tCross = Date.now()
    const cross = await page.evaluate(async (name) => {
      const g = window.__capy
      const from = g.biome.current
      const t0 = performance.now()
      const gaps = []
      let last = t0, tSwitch = -1, tFirstFrame = -1
      const p = new Promise(res => {
        const f = (t) => {
          const gap = t - last; last = t
          gaps.push(gap)
          if (g.biome.current === name && tSwitch < 0) tSwitch = t - t0
          if (tSwitch >= 0 && tFirstFrame < 0 && gap < 200 && g.biome.current === name) tFirstFrame = t - t0
          if (t - t0 < 9000) requestAnimationFrame(f); else res()
        }
        requestAnimationFrame(f)
      })
      g.hud.cross(name)
      await p
      let maxGap = 0, over100 = 0, over500 = 0
      for (const x of gaps) { if (x > maxGap) maxGap = x; if (x > 100) over100++; if (x > 500) over500++ }
      return { from, tSwitch: +tSwitch.toFixed(0), tFirstFrame: +tFirstFrame.toFixed(0),
        maxGap: +maxGap.toFixed(0), over100, over500, frames: gaps.length }
    }, n)
    const stand = await sample('stand')
    await page.keyboard.down('KeyW')
    await page.keyboard.down('ShiftLeft')
    const walk = await sample('run')
    await page.keyboard.up('ShiftLeft')
    await page.keyboard.up('KeyW')
    const st = await page.evaluate((name) => {
      const g = window.__capy
      let inWorld = 0
      for (const b of g.world.bodies) inWorld++
      const p = g.capy.position
      return { biome: g.biome.current, ok: g.biome.current === name, started: g.state.started,
        bodies: inWorld, contacts: g.world.contacts.length, substeps: g.state.perf.substeps,
        mem: JSON.parse(JSON.stringify(g.renderer.info.memory)), programs: g.renderer.info.programs.length,
        perf: g.perfAudit ? g.perfAudit() : null, pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
        lastError: g.state.lastError || null, time: +g.state.time.toFixed(1) }
    }, n)
    rows.push({ name: n, cross, stand, walk, st })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-perf.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { boot, rows })
}
