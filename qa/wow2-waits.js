async page => {
  // ROADMAP-WOW2 N3 — SOMEONE WAITS. Three reads, on kyoto's regular (the
  // step-sweeper) for 1/2, and venice's pigeon for 3 (one of six kinds run
  // live end to end; the other five share the same compLeave/jrChapHome
  // code path, parameterised only by kind/biome — see the report).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(4500)

  await page.evaluate((n) => window.__capy.hud.cross(n), 'kyoto')
  await page.waitForTimeout(9500)
  await page.evaluate(() => { const g = window.__capy; g.events.emit('pal:warm', {}); g.events.emit('pal:warm', {}) })
  out.tierAfterTwoWarms = await page.evaluate(() => window.__capy.palDebug())

  // ---- 1. the absence line: 5 min away (no arm) vs 20 min away (arms) ----
  out.fiveMin = await page.evaluate(() => {
    const g = window.__capy
    g.state.qaChapLeftSet(4, g.state.qaJrTotalMs() - 5 * 60 * 1000)
    let armed = false
    const orig = g.palAwayArm
    g.palAwayArm = function (b, ms) { armed = true; orig.call(g, b, ms) }
    g.events.emit('biome:enter', { name: 'kyoto', from: 'sydney' })
    g.palAwayArm = orig
    return { armed }
  })
  out.twentyMin = await page.evaluate(() => {
    const g = window.__capy
    g.state.qaChapLeftSet(4, g.state.qaJrTotalMs() - 21 * 60 * 1000)
    let armed = false, seenMs = 0
    const orig = g.palAwayArm
    g.palAwayArm = function (b, ms) { armed = true; seenMs = ms; orig.call(g, b, ms) }
    g.events.emit('biome:enter', { name: 'kyoto', from: 'sydney' })
    g.palAwayArm = orig
    return { armed, seenMs }
  })

  // ---- 2. the kept gift: tier 3, >=3 rows since the snapshot -------------
  out.keptGift = await page.evaluate(() => {
    const g = window.__capy
    g.events.emit('pal:warm', {})   // tier 2 -> 3
    g.state.qaChapRowsSet(4, 0)
    const ids = (g.tasksInChapter(4) || []).slice(0, 3)
    for (const id of ids) g.completeTask(id, true)
    let armed = false
    const orig = g.palKeptArm
    g.palKeptArm = function (b) { armed = true; orig.call(g, b) }
    g.events.emit('biome:enter', { name: 'kyoto', from: 'sydney' })
    g.palKeptArm = orig
    return { armed, tier: g.palDebug() }
  })
  out.keptGiftAgain = await page.evaluate(() => {
    // no new rows since — must not re-arm ("never twice in a row")
    const g = window.__capy
    let armed = false
    const orig = g.palKeptArm
    g.palKeptArm = function (b) { armed = true; orig.call(g, b) }
    g.events.emit('biome:enter', { name: 'kyoto', from: 'sydney' })
    g.palKeptArm = orig
    return { armed }
  })

  // ---- 3. one companion homecoming, live: the pigeon, home to Venice -----
  // board it via the real door: put it on the file as already stowed,
  // reload, land elsewhere, then cross to its own chapter. jrFileCount has
  // to be > 0 or the title card treats this as no file at all and Begin
  // takes the fresh (saveClear()) branch instead of Carry on's restore.
  const oneTaskId = (await page.evaluate(() => (window.__capy.tasksInChapter(1) || [])[0])) || 'wheek-sydney'
  await page.addInitScript((tid) => {
    try {
      localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: [tid], seen: [1], recs: {}, ms: 0, stow: { kind: 'pigeon', from: 'venice' } }))
    } catch (e) {}
  }, oneTaskId)
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); if (c) c.click(); else document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(4500)
  out.stowedAtBoot = await page.evaluate(() => window.__capy.stowDebug())
  await page.evaluate((n) => window.__capy.hud.cross(n), 'venice')
  await page.waitForTimeout(9500)
  out.homeResult = await page.evaluate(() => window.__capy.stowDebug())

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow2-waits', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
