async page => {
  // L5 M4 — THE GRAND PRIX: contact (the car put in a pack car's lane at its
  // arclength: rubs > 0, lat moved away, speed down) and the podium (a lap
  // ended with every car passed: slow-mo, sparks, shells). qa/l5-gp.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('monaco') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const R = o => page.evaluate(o => { const g = window.__capy, r = g.monaco.raceDebug(o); r.ts = +(g.state.timeScale || 1).toFixed(2); r.sparks = g.sparksLive(); return r }, o || {})
  out.take = await R({ take: true })
  // the lights: wait them out, then W
  await page.waitForTimeout(6000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1500)
  out.go = await R({})
  // contact: onto car 1's lane and arclength, at speed
  const c = out.go.cars[1]
  out.rub0 = await R({ s: c[0] - 1.0, lat: c[2], v: 20 })
  await page.waitForTimeout(300)
  out.rub1 = await R({})
  await page.waitForTimeout(1200)
  out.rub2 = await R({})
  // the podium: every car passed, and the line a few metres ahead
  out.pod0 = await R({ passed: 3, dist: out.go.total - 7 - 6, v: 30, lat: -2.6 })
  await page.waitForTimeout(350)
  out.pod1 = await R({})
  await page.waitForTimeout(900)
  out.pod2 = await R({})
  await page.keyboard.up('KeyW')
  // the podium itself, forced: the payout the harness cannot race for
  out.podium = await R({ podium: true })
  await page.waitForTimeout(900)
  out.podium2 = await R({})
  out.record = await page.evaluate(() => window.__capy.hud.recordAudit().best['the-tunnel'])
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-gp.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
