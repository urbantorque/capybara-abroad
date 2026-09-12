async page => {
  // L5 M2 — THE FERRY: the humpback in the Heads. Cross to the Quay, the
  // animal to the helm, the wheel taken (helmDebug), W held for way on, the
  // boat put in the gap (boatDebugTo 80, -360): the whale should come up
  // within a second — sampled every 120 ms: t, y, timeScale, camInfo.shot,
  // sparks, the hull's roll. Then a second placing in the gap on the same
  // passage: no second whale. qa/l5-ferry.json; qa/l5-ferry-whale.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('quay') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.helm = await page.evaluate(() => {
    const g = window.__capy, q = g.quay, b = g.capy.body, h = q.boat.helm
    b.position.set(h.x, h.y + 0.6, h.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    return q.helmDebug(true)
  })
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(4000)
  out.underway = await page.evaluate(() => window.__capy.quay.whaleAudit())
  await page.evaluate(() => window.__capy.quay.boatDebugTo(80, -330))
  const rows = []
  let shot = false
  for (let k = 0; k < 45; k++) {
    await page.waitForTimeout(120)
    const r = await page.evaluate(() => { const g = window.__capy, w = g.quay.whaleAudit(); return { t: w.t, y: w.y, vis: w.visible, spl: w.splashed, heads: w.heads, speed: w.speed, ts: +(g.state.timeScale || 1).toFixed(2), shot: +g.camInfo.shot.toFixed(2), sparks: g.sparksLive() } })
    rows.push(r)
    if (!shot && r.t > 1.2) { shot = true; await page.screenshot({ path: 'qa/l5-ferry-whale.png', timeout: 90000 }) }
  }
  await page.keyboard.up('KeyW')
  out.rows = rows
  out.after = await page.evaluate(() => window.__capy.quay.whaleAudit())
  await page.evaluate(() => window.__capy.quay.boatDebugTo(60, -360))
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyW')
  out.second = await page.evaluate(() => window.__capy.quay.whaleAudit())
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-ferry.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
