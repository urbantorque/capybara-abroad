async page => {
  const CH = 'pasto'
  const out = { CH, errs: [], log: [], toasts: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') out.errs.push(m.text().slice(0, 200)) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5195/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(7000)
  for (let i = 0; i < 3; i++) {
    const cur = await page.evaluate(() => window.__capy.biome.current)
    if (cur === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(11000)
  }
  // both variants in one visit: A = the build as shipped, B = noCondorOpen (the old way)
  for (const variant of ['A', 'B']) {
    await page.evaluate(v => {
      const g = window.__capy, c = g.condor, b = g.capy.body
      g.state.journeyMode = 'story'
      g.state.noCondorOpen = v === 'B'
      if (!window.__t1eToast) {
        window.__t1eToasts = []
        const t0 = g.toast; g.toast = function (s) { window.__t1eToasts.push(String(s)); return t0.apply(this, arguments) }
        window.__t1eToast = 1
      }
      // the diag run's jam: the animal beside the stall row, the bird under its roof
      const h = g.pasto.terrainHeight(25.4, 26.7)
      b.position.set(25.4, h + 0.4, 26.7); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (c.state === 'gone') { c.summon() }
    }, variant)
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(300)
      const st = await page.evaluate(() => window.__capy.condor.state)
      if (st === 'circling') break
    }
    await page.evaluate(() => {
      const g = window.__capy, c = g.condor, cb = c.body
      c.summon()                                   // lower
      const h = g.pasto.terrainHeight(23.3, 28.0)
      cb.position.set(23.3, h + 1.9, 28.0); cb.velocity.set(0, 0, 0); cb.angularVelocity.set(0, 0, 0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    })
    const rows = []
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250)
      rows.push(await page.evaluate(() => {
        const g = window.__capy, c = g.condor, b = c.body.position
        return { t: +g.state.time.toFixed(2), rung: g.state.perfRung, st: c.state, agl: +(b.y - g.pasto.terrainHeight(b.x, b.z)).toFixed(2),
          x: +b.x.toFixed(1), z: +b.z.toFixed(1), reach: c.talonInReach(), a: c.condorAudit() }
      }))
    }
    if (variant === 'A') await page.screenshot({ path: 'qa/ten-t1e-stuck-A.png' })
    const tail = rows.slice(-12)
    out[variant] = { rows, maxAgl: Math.max(...rows.map(r => r.agl)), tailMinAgl: Math.min(...tail.map(r => r.agl)),
      pins: rows[rows.length - 1].a.pins, opens: rows[rows.length - 1].a.opens, maxStuckT: Math.max(...rows.map(r => r.a.stuckT)),
      reachN: rows.filter(r => r.reach).length }
  }
  await page.evaluate(() => { window.__capy.state.noCondorOpen = false })
  out.toasts = await page.evaluate(() => window.__t1eToasts || [])
  out.result = { A: { maxAgl: out.A.maxAgl, tailMinAgl: out.A.tailMinAgl, pins: out.A.pins, opens: out.A.opens, reachN: out.A.reachN, maxStuckT: out.A.maxStuckT },
                 B: { maxAgl: out.B.maxAgl, tailMinAgl: out.B.tailMinAgl, pins: out.B.pins, reachN: out.B.reachN },
                 said: out.toasts.filter(s => /more sky/.test(s)) }
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t1e-stuck-' + Date.now() + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
