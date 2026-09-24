async page => {
  // T3e: the Hanoi arrival as a player gets it. Fresh free file, real clock,
  // cross into Hanoi, then read the lens and screenshot it at +1.2 s and +3.5 s
  // after the teleport (the arrival shot holds for sysARRIVE_HOLD, 1.95 s).
  // Also reads game.hanoi.willow() (the T3e audit) where it exists.
  // Fresh session after any hanoi.js edit (modules cache across goto).
  const NAME = 'ten-t3e-arrive'
  const PORT = 5195
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  out.started = await page.evaluate(() => !!window.__capy.state.started)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('hanoi') })
  // wait for the teleport: the animal lands within 3 m of the spawn
  let t0 = Date.now(), arrived = false
  while (Date.now() - t0 < 40000) {
    arrived = await page.evaluate(() => {
      const g = window.__capy
      if (g.biome.current !== 'hanoi' || !g.hanoi) return false
      const s = g.hanoi.SPAWN, p = g.capy.position
      return Math.hypot(p.x - s.x, p.z - s.z) < 4
    })
    if (arrived) break
    await page.waitForTimeout(150)
  }
  out.arrived = arrived
  const read = () => page.evaluate(() => {
    const g = window.__capy, c = g.camera.position, p = g.capy.position
    const fa = g.farGlanceAudit ? g.farGlanceAudit() : null
    const w = g.hanoi && g.hanoi.willow ? g.hanoi.willow() : null
    return { cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], capy: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
             camYaw: +Math.atan2(c.x - p.x, c.z - p.z).toFixed(3), shot: fa, framing: g.framing ? +g.framing().toFixed(3) : null,
             rung: g.state.perfRung, willow: w, t: +g.state.time.toFixed(2) }
  })
  await page.waitForTimeout(1200)
  out.a = await read()
  await page.screenshot({ path: 'qa/' + NAME + '-a.png' })
  await page.waitForTimeout(2300)
  out.b = await read()
  await page.screenshot({ path: 'qa/' + NAME + '-b.png' })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
