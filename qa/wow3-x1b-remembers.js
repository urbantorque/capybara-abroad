async page => {
  // ROADMAP-WOW3 X1b — THE PLACE REMEMBERS. Same two-part shape wow2-waits.js
  // used for N3's own absence line: (A) a spy on game.worldAwayArm proves
  // sysWorldAwayCheck's own gate — 5 min away does not arm, ~25 min does,
  // for all three chosen chapters (quay=3, kyoto=4, venice=10 — CHAPTERS,
  // shared.js); (B) one real, live end-to-end crossing (quay) proves the
  // armed flag actually changes what npcMakeStall builds — read via
  // game.state.qaWorldStall(biome) -> {armed, swapped} (npc.js) — plus a
  // screenshot pair read by eye.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs, gate: {} }

  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(4500)

  // ---- B. live, end to end FIRST, on a still-unarmed quay — running the
  // spy-based gate test (A, below) first would call the REAL worldAwayArm
  // as a side effect (it forwards to `orig`, on purpose, the same way
  // wow2-waits.js's own spy on palAwayArm does) and contaminate this read.
  await page.evaluate(() => { const g = window.__capy; g.hud.cross('quay') })
  await page.waitForTimeout(9500)
  out.quayFirst = await page.evaluate(() => window.__capy.state.qaWorldStall('quay'))
  await page.evaluate(() => { const g = window.__capy; g.hud.cross('sydney') })
  await page.waitForTimeout(9500)
  await page.evaluate(() => {
    const g = window.__capy
    g.state.qaChapLeftSet(3, g.state.qaJrTotalMs() - 5 * 60 * 1000)
  })
  await page.evaluate(() => { const g = window.__capy; g.hud.cross('quay') })
  await page.waitForTimeout(9500)
  out.quayShort = await page.evaluate(() => window.__capy.state.qaWorldStall('quay'))
  await page.screenshot({ path: 'qa/wow3-x1b-quay-short.png' })
  await page.evaluate(() => { const g = window.__capy; g.hud.cross('sydney') })
  await page.waitForTimeout(9500)
  await page.evaluate(() => {
    const g = window.__capy
    g.state.qaChapLeftSet(3, g.state.qaJrTotalMs() - 25 * 60 * 1000)
  })
  await page.evaluate(() => { const g = window.__capy; g.hud.cross('quay') })
  await page.waitForTimeout(9500)
  out.quayLong = await page.evaluate(() => window.__capy.state.qaWorldStall('quay'))
  await page.screenshot({ path: 'qa/wow3-x1b-quay-long.png' })

  // ---- A. the gate, all three, both sides (fast: no real crossing). Runs
  // AFTER B on purpose — see the note above.
  const chapNs = { quay: 3, kyoto: 4, venice: 10 }
  for (const biome in chapNs) {
    const n = chapNs[biome]
    out.gate[biome] = await page.evaluate(({ biome, n }) => {
      const g = window.__capy
      let armed5 = false, armed25 = false, seenMs = 0
      const orig = g.worldAwayArm
      // 5 minutes: must NOT arm
      g.state.qaChapLeftSet(n, g.state.qaJrTotalMs() - 5 * 60 * 1000)
      g.worldAwayArm = function (b, ms) { armed5 = true; orig.call(g, b, ms) }
      g.events.emit('biome:enter', { name: biome, from: 'sydney' })
      g.worldAwayArm = orig
      // 25 minutes: must arm
      g.state.qaChapLeftSet(n, g.state.qaJrTotalMs() - 25 * 60 * 1000)
      g.worldAwayArm = function (b, ms) { armed25 = true; seenMs = ms; orig.call(g, b, ms) }
      g.events.emit('biome:enter', { name: biome, from: 'sydney' })
      g.worldAwayArm = orig
      return { armed5, armed25, seenMs }
    }, { biome, n })
  }
  // ---- ...and one chapter NOT on the list — must never arm, any absence ---
  out.gate.pasto = await page.evaluate(() => {
    const g = window.__capy
    let armed = false
    const orig = g.worldAwayArm
    g.state.qaChapLeftSet(2, g.state.qaJrTotalMs() - 999 * 60 * 1000)
    g.worldAwayArm = function (b, ms) { armed = true; orig.call(g, b, ms) }
    g.events.emit('biome:enter', { name: 'pasto', from: 'sydney' })
    g.worldAwayArm = orig
    return { armed }
  })

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow3-x1b-remembers', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
