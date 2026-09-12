async page => {
  // L5 M3 — THE JETPACK: a ring fills the tank (fuel before/after), the
  // fourth ring slows the world, the minaret files the time and holds the
  // world, a landing puts up dust (sparks), and E on the crate after the
  // tick is a second run (run true, next 0). qa/l5-jet.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('sahara') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const jet = () => page.evaluate(() => { const g = window.__capy, j = g.sahara.jet(); j.ts = +(g.state.timeScale || 1).toFixed(2); j.sparks = g.sparksLive(); return j })
  await page.evaluate(() => { const g = window.__capy, p = g.sahara.jetPack(), b = g.capy.body; b.position.set(p.x + 1, p.y + 1, p.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); g.sahara.jetDebug({ take: true }) })
  await page.waitForTimeout(600)
  out.taken = await jet()
  // burn the tank down, then through ring one: the fuel should come back by 1.6
  await page.keyboard.down('Space'); await page.waitForTimeout(2200); await page.keyboard.up('Space')
  await page.waitForTimeout(300)
  out.burnt = await jet()
  const rings = out.taken.rings
  await page.evaluate(r => window.__capy.sahara.jetDebug({ x: r[0], y: r[1] - 0.6, z: r[2] }), rings[0])
  await page.waitForTimeout(400)
  out.ring1 = await jet()
  for (let i = 1; i < 4; i++) {
    await page.evaluate(r => window.__capy.sahara.jetDebug({ x: r[0], y: r[1] - 0.6, z: r[2] }), rings[i])
    await page.waitForTimeout(i === 3 ? 250 : 500)
  }
  out.ring4 = await jet()
  await page.waitForTimeout(1500)
  // a landing on the sand from height: dust
  await page.evaluate(() => { const g = window.__capy, j = g.sahara.jet(); g.sahara.jetDebug({ x: j.x, y: j.y + 12, z: j.z }) })
  for (let k = 0; k < 20; k++) { await page.waitForTimeout(100); const j = await jet(); if (j.ground && k > 2) { out.landed = j; break } }
  // the minaret: put the pack over the top and let it settle
  await page.evaluate(() => { const g = window.__capy; g.sahara.jetDebug({ x: -52, y: 45, z: 4 }) })
  await page.waitForTimeout(1800)
  out.minaret = await jet()
  out.record = await page.evaluate(() => window.__capy.hud.recordAudit().best['jetpack'])
  out.taskDone = await page.evaluate(() => window.__capy.taskDone('jetpack'))
  // the second run: off, back to the crate, on again
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500)
  await page.evaluate(() => { const g = window.__capy, p = g.sahara.jetPack(), b = g.capy.body; b.position.set(p.x + 1, p.y + 1, p.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); g.sahara.jetDebug({ take: true }) })
  await page.waitForTimeout(600)
  out.second = await jet()
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-jet.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
