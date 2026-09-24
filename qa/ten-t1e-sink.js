async page => {
  const CH = 'pasto'
  const out = { CH, errs: [], log: [], touch: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
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
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'story'; g.condor.summon() })
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250)
    const s = await page.evaluate(() => {
      const g = window.__capy, c = g.condor, b = c.body.position, v = c.body.velocity, cp = g.capy.body.position
      // who is the bird touching right now
      const touch = []
      for (const ct of g.world.contacts) {
        const o = ct.bi === c.body ? ct.bj : ct.bj === c.body ? ct.bi : null
        if (!o) continue
        touch.push({ id: o.id, m: o.mass, n: o.__name || o.name || (o.userData && o.userData.kind) || '', y: +o.position.y.toFixed(1),
          sh: o.shapes.map(s => s.type).join(','), ny: +((ct.bi === c.body ? -1 : 1) * ct.ni.y).toFixed(2), capy: o === g.capy.body })
      }
      return { t: +g.state.time.toFixed(2), st: c.state, y: +b.y.toFixed(1), x: +b.x.toFixed(1), z: +b.z.toFixed(1), vy: +v.y.toFixed(1),
        sp: +Math.hypot(v.x, v.y, v.z).toFixed(1), cp: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)], touch, a: c.condorAudit() }
    })
    out.log.push(s)
    if (i === 24) await page.evaluate(() => window.__capy.condor.summon())
  }
  await page.screenshot({ path: 'qa/ten-t1e-sink.png' })
  out.result = { n: out.log.length }
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t1e-sink-' + Date.now() + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
