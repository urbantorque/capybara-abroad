async page => {
  // L5 M4 — THE DROP INTO THE LIGHT: three hoops in the shaft. The animal is
  // put in the air over hoop one's centre at the cap's height and falls:
  // through at least two (the third needs a metre of A/D), the chime and
  // sparks per hoop, the lens low (camInfo.shot), the world at half speed,
  // the drop filed. qa/l5-column.json; qa/l5-column-fall.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('cave') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.rings = await page.evaluate(() => window.__capy.cave.colRings())
  const r0 = out.rings.rings[0]
  await page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, -1, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [r0.x, out.rings.top + 1.0, r0.z])
  const rows = []
  let shot = false
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(100)
    const r = await page.evaluate(() => { const g = window.__capy, c = g.cave.colRings(); return { y: +g.capy.position.y.toFixed(1), on: c.on, through: c.through, drop: c.drop, ts: +(g.state.timeScale || 1).toFixed(2), shot: +g.camInfo.shot.toFixed(2), sparks: g.sparksLive(), swell: g.musAudit ? (g.musAudit().swell !== undefined ? g.musAudit().swell : null) : null } })
    rows.push(r)
    if (!shot && r.through >= 1) { shot = true; await page.screenshot({ path: 'qa/l5-column-fall.png', timeout: 90000 }) }
    if (k > 8 && !r.on) break
  }
  out.rows = rows
  out.after = await page.evaluate(() => window.__capy.cave.colRings())
  out.record = await page.evaluate(() => window.__capy.hud.recordAudit().best['the-column'])
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-column.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
