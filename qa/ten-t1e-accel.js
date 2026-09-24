async page => {
  const CH = 'pasto'
  const out = { CH, errs: [] }
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
  // keep the animal off the talons for the whole sample: E is never pressed,
  // and the leap rule needs a jump, so it stays a measurement of the orbit
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'story'; g.condor.summon() })
  await page.waitForTimeout(9000)
  await page.evaluate(() => window.__capy.condor.summon())
  await page.waitForTimeout(6000)
  out.m = await page.evaluate(() => new Promise(res => {
    const g = window.__capy, c = g.condor, b = c.body, W = g.world
    const acc = { n: 0, fy: 0, dvy: 0, pre: 0, gy: W.gravity.y, subs: [], y: [] }
    let vy0 = 0, fy0 = 0
    const pre = () => { vy0 = b.velocity.y; fy0 = b.force.y }
    const post = () => { acc.n++; acc.fy += fy0 / b.mass; acc.dvy += (b.velocity.y - vy0) / W.dt }
    // registered last, so it sees the force after every other preStep listener
    W.addEventListener('preStep', pre); W.addEventListener('postStep', post)
    const iv = setInterval(() => { acc.y.push(+b.position.y.toFixed(2)); acc.subs.push(g.state.perf && g.state.perf.substeps) }, 200)
    setTimeout(() => {
      clearInterval(iv); W.removeEventListener('preStep', pre); W.removeEventListener('postStep', post)
      res({ n: acc.n, meanFy: +(acc.fy / acc.n).toFixed(2), meanAy: +(acc.dvy / acc.n).toFixed(2), g: acc.gy, st: c.state,
        y: acc.y, subs: acc.subs, a: c.condorAudit(), mass: b.mass, lin: b.linearDamping, resp: b.collisionResponse, type: b.type })
    }, 5000)
  }))
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t1e-accel-' + Date.now() + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
