async page => {
  // L5 M3 — THE ACQUA ALTA, every tide higher: the phase wound through a
  // whole cycle with the animal in the square (the tick at the first crest),
  // the fall edge raises the next tide (high 0.95 → 1.04), the second crest
  // reaches it, and the crest of the second tide is said (crestSaid, slow-mo).
  // qa/l5-venice.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const A = () => page.evaluate(() => { const g = window.__capy, a = g.venice.tideAudit(); a.ts = +(g.state.timeScale || 1).toFixed(2); return a })
  // into the middle of the square
  await page.evaluate(() => { const b = window.__capy.capy.body; b.position.set(0, 0.8, -34); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.waitForTimeout(500)
  out.t0 = await A()
  // the first rise: phase just before the front, then the crest
  await page.evaluate(() => window.__capy.venice.phaseDebug(0.33)); await page.waitForTimeout(3000)
  await page.evaluate(() => window.__capy.venice.phaseDebug(0.42)); await page.waitForTimeout(2500)
  out.front = await A()
  await page.evaluate(() => window.__capy.venice.phaseDebug(0.52)); await page.waitForTimeout(3000)
  out.crest1 = await A()
  out.task = await page.evaluate(() => window.__capy.taskDone('acqua-alta'))
  // the fall, and the next tide's ceiling
  await page.evaluate(() => window.__capy.venice.phaseDebug(0.95)); await page.waitForTimeout(3500)
  out.fall = await A()
  await page.evaluate(() => { const b = window.__capy.capy.body; b.position.set(0, 0.8, -34); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.evaluate(() => window.__capy.venice.phaseDebug(0.52)); await page.waitForTimeout(3500)
  out.crest2 = await A()
  await page.waitForTimeout(1000)
  out.crest2b = await A()
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-venice.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
