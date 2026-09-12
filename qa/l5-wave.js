async page => {
  // L5 M4 — THE BIG WAVE: the barrel forced up (barrelDebug), two seconds in
  // it is a moment: beat true, camInfo.shot up, timeScale 0.6, sparks; the
  // toast on the way out says the best. qa/l5-wave.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('manly') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(() => { const g = window.__capy; g.__toasts = []; const t0 = g.toast; g.toast = function (s) { g.__toasts.push(String(s).slice(0, 60)); return t0.apply(this, arguments) }; g.manly.barrelDebug(true) })
  const rows = []
  for (let k = 0; k < 30; k++) { await page.waitForTimeout(120); rows.push(await page.evaluate(() => { const g = window.__capy, b = g.manly.barrelDebug(); return { k: b.k, t: b.t, beat: b.beat, ts: +(g.state.timeScale || 1).toFixed(2), shot: +g.camInfo.shot.toFixed(2), sparks: g.sparksLive() } })) }
  await page.evaluate(() => window.__capy.manly.barrelDebug(false))
  await page.waitForTimeout(1500)
  out.rows = rows
  out.toasts = await page.evaluate(() => window.__capy.__toasts)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-wave.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
