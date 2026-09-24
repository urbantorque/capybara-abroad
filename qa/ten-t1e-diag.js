async page => {
  const CH = 'pasto'
  const out = { CH, errs: [], log: [] }
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
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  const st = () => page.evaluate(() => {
    const g = window.__capy, c = g.condor, b = c.body.position, v = c.body.velocity, p = g.capy.body.position
    const th = g.pasto.terrainHeight(b.x, b.z)
    return { t: +g.state.time.toFixed(1), st: c.state, rung: g.state.perfRung, bx: +b.x.toFixed(1), by: +b.y.toFixed(1), bz: +b.z.toFixed(1),
      agl: +(b.y - th).toFixed(2), vy: +v.y.toFixed(2), sp: +Math.hypot(v.x, v.y, v.z).toFixed(1),
      px: +p.x.toFixed(1), py: +p.y.toFixed(2), pz: +p.z.toFixed(1), reach: c.talonInReach(), aud: c.audit ? c.audit() : null }
  })
  out.log.push(await st())
  await page.keyboard.press('KeyQ')
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500)
    const s = await st()
    out.log.push(s)
    if (s.st === 'circling') break
  }
  await page.keyboard.press('KeyQ')
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(400)
    out.log.push(await st())
  }
  await page.screenshot({ path: 'qa/ten-t1e-diag.png' })
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t1e-diag.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
