async page => {
  // L5 M2 — THE RIVER RUN: a boat gate takes two seconds off the clock (the
  // live figure drops, the paper says −2 s), the finish spins the wheel up
  // and slows the world. The animal is put in the river fifteen metres above
  // gate one and carried through it; then forty-five metres above the mill
  // and carried in. qa/l5-uji.json; qa/l5-uji-finish.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('kyoto') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const tp = (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const audit = () => page.evaluate(() => { const g = window.__capy, a = g.kyoto.runAudit(); a.live = g.hud.recordAudit().val; a.line = (document.querySelector('.capyui-marqlive') || {}).textContent || ''; a.ts = +(g.state.timeScale || 1).toFixed(2); a.sparks = g.sparksLive(); return a })
  out.before = await audit()
  const g1 = out.before.gates[0]
  const up = await page.evaluate(([x, z]) => { const u = window.__capy.kyoto.aheadOnRiver(x, z, -14); return { x: u.x, z: u.z } }, [g1.x, g1.z])
  await tp(up.x, -0.5, up.z)
  await page.keyboard.down('KeyW')
  const rows = []
  for (let k = 0; k < 60; k++) { await page.waitForTimeout(200); const a = await audit(); rows.push({ t: a.t, through: a.through, bonusT: a.bonusT, live: a.live, line: a.line.slice(0, 60) }); if (a.through >= 1 && k > 3) break }
  await page.keyboard.up('KeyW')
  out.gate = rows
  // the finish
  const mill = out.before.mill
  const up2 = await page.evaluate(([x, z]) => { const u = window.__capy.kyoto.aheadOnRiver(x, z, -36); return { x: u.x, z: u.z } }, [mill.x, mill.z])
  await tp(up2.x, -0.5, up2.z)
  await page.keyboard.down('KeyW')
  const rows2 = []
  let shot = false
  for (let k = 0; k < 120; k++) { await page.waitForTimeout(200); const a = await audit(); rows2.push({ t: a.t, millFast: a.millFast, ts: a.ts, sparks: a.sparks, done: a.done }); if (a.millFast > 0 && !shot) { shot = true; await page.screenshot({ path: 'qa/l5-uji-finish.png', timeout: 90000 }) } if (a.millFast > 0 && k > 3 && rows2.length > 6 && rows2[rows2.length - 1].ts >= 1 && rows2[rows2.length - 3].millFast > 0) break }
  await page.keyboard.up('KeyW')
  out.finish = rows2
  out.record = await page.evaluate(() => window.__capy.hud.recordAudit().best['uji-run'])
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-uji.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
