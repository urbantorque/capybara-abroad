async page => {
  // L5 M4 — THE HERD CROSSING: mid-river with five on the line, O Grandão
  // comes; the lunge (timeScale < 1 once a round inside 7.5 m), and three
  // wheeks (Q) when he is in earshot — the third holds the world, throws the
  // river up (sparks) and swings the lens. qa/l5-crossing.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('pantanal') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const cross = await page.evaluate(() => { const g = window.__capy; return g.pantanal.riverDebug ? g.pantanal.riverDebug() : null })
  const cx = (cross && cross.crossX !== undefined) ? cross.crossX : -34
  await page.evaluate(x => { const b = window.__capy.capy.body; b.position.set(x, -0.2, -70); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, cx)
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__capy.pantanal.herdFollow(5))
  const rows = []
  let wheeks = 0, lunges = 0
  for (let i = 0; i < 160; i++) {
    await page.waitForTimeout(150)
    const d = await page.evaluate(() => { const g = window.__capy, h = g.pantanal.huntDebug(); const p = g.capy.body.position; h.dist = +Math.hypot(h.hx - p.x, h.hz - p.z).toFixed(1); h.ts = +(g.state.timeScale || 1).toFixed(2); h.shot = +g.camInfo.shot.toFixed(2); h.sparks = g.sparksLive(); return h })
    if (d.ts < 0.95) lunges++
    rows.push({ t: i, on: d.on, dist: d.dist, lives: d.lives, round: d.round, under: d.under, ts: d.ts, shot: d.shot, sparks: d.sparks, beaten: d.beaten })
    // in earshot (panHUNT_HEAR is generous) and up: wheek
    if (d.on && d.under <= 0 && d.dist < 18 && wheeks < 3) { await page.keyboard.press('KeyQ'); wheeks++; await page.waitForTimeout(400) }
    if (d.beaten && i > 4) { await page.waitForTimeout(600); rows.push(await page.evaluate(() => { const g = window.__capy, h = g.pantanal.huntDebug(); h.ts = +(g.state.timeScale || 1).toFixed(2); h.shot = +g.camInfo.shot.toFixed(2); h.sparks = g.sparksLive(); return { beatenAfter: true, ts: h.ts, shot: h.shot, sparks: h.sparks } })); break }
    if (d.took > 0 && i > 100) break
  }
  out.rows = rows.filter((r, i) => i % 3 === 0 || r.ts < 0.95 || r.beaten || r.beatenAfter)
  out.wheeks = wheeks; out.slowFrames = lunges
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-crossing.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
