async page => {
  // L5 M3 — THE LANTERN dims and is relit higher: lit by the hook, aged past
  // 300 s → the pilot glow, the flies home, the beacons cold, the far lamps
  // out; eight flies woken at the plinth and E → relit: glow back to 1, the
  // wave from 0, record 8. qa/l5-lantern.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('drift') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const L = o => page.evaluate(o => window.__capy.drift.lanternDebug(o), o || {})
  await page.evaluate(() => { const g = window.__capy, l = g.drift.lantern, b = g.capy.body; b.position.set(l.x + 3, l.y + 1.2, l.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.waitForTimeout(500)
  out.lit = await L({ lit: true })
  await page.waitForTimeout(6000)
  out.burning = await L({})
  out.aged = await L({ age: 301 })
  await page.waitForTimeout(4000)
  out.dim = await L({})
  out.woke = await L({ wake: 8 })
  await page.waitForTimeout(800)
  out.live = await page.evaluate(() => { const g = window.__capy; return { val: g.hud.recordAudit().val, live: g.hud.recordAudit().live, line: (document.querySelector('.capyui-marqlive') || {}).textContent || '' } })
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(3000)
  out.relit = await L({})
  out.record = await page.evaluate(() => window.__capy.hud.recordAudit().best['lantern'])
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-lantern.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
