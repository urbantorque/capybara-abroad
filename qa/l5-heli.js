async page => {
  // L5 M3 — THE HELICOPTER: a lap of eight rings (the heli moved ring to
  // ring), the eighth held and framed (timeScale, camInfo.shot, sparks), the
  // record; then E on the H again is a second lap (run true, ring 0) and its
  // own record. qa/l5-heli.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('kowloon') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const H = o => page.evaluate(o => { const g = window.__capy, h = g.kowloon.heliDebug(o); h.ts = +(g.state.timeScale || 1).toFixed(2); h.shot = +g.camInfo.shot.toFixed(2); h.sparks = g.sparksLive(); return h }, o || {})
  const lap = async (tag) => {
    out[tag] = { take: await H({ take: true }) }
    await page.waitForTimeout(600)
    for (let i = 0; i < 8; i++) {
      const r = await page.evaluate(i => window.__capy.kowloon.ringAt(i), i)
      await H({ x: r.x, y: r.y, z: r.z })
      await page.waitForTimeout(i === 7 ? 300 : 700)
    }
    out[tag].eighth = await H({})
    await page.waitForTimeout(2500)
    out[tag].after = await H({})
    out[tag].record = await page.evaluate(() => window.__capy.hud.recordAudit().best['symphony'])
  }
  await lap('lap1')
  // out at the H, and in again
  await page.evaluate(() => { const g = window.__capy, h = g.kowloon.heliHome ? g.kowloon.heliHome() : null; if (h) g.kowloon.heliDebug({ x: h.x, y: h.y, z: h.z }) })
  await page.waitForTimeout(800)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800)
  out.left = await H({})
  await lap('lap2')
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-heli.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
