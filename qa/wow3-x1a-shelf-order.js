async page => {
  // ROADMAP-WOW3 X1a — THE SHELF IN EARN ORDER. Three saves, same three held
  // chapters (3, 10, 16), `keptAt` scrambled a different way each time —
  // confirms the shelf's physical left-to-right order (read off each held
  // chapter's own keepsake prop, physics.keepOut(biome).body.position.z)
  // follows `keptAt` ascending, not the chapter number. Same technique as
  // qa/wow2-shelf.js: real task ids, a real completeTask path on restore
  // (chapComplete -> keepHeld true), not a faked keepHeld.
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

  const idsByChap = await page.evaluate(() => {
    const g = window.__capy
    const out = {}
    for (const k of [3, 10, 16]) { try { out[k] = (g.tasksInChapter(k) || []).map(t => t.id || t) } catch (e) { out[k] = [] } }
    return out
  })
  // chapter -> biome, fixed by CHAPTERS in shared.js: 3=quay, 10=venice, 16=cave
  out.biomeByChap = { 3: 'quay', 10: 'venice', 16: 'cave' }

  async function bootWith(keptAt) {
    const ids = []
    for (const k of [3, 10, 16]) for (const id of (idsByChap[k] || [])) ids.push(id)
    await page.addInitScript((argsIn) => {
      try {
        localStorage.clear()
        localStorage.setItem('capy3.journey.v1', JSON.stringify({
          v: 1, tasks: argsIn.ids, seen: [], recs: {}, ms: 0, keptAt: argsIn.keptAt, biome: 'sydney',
        }))
      } catch (e) {}
    }, { ids, keptAt })
    await page.goto('http://localhost:5188/index.html')
    await page.waitForTimeout(4500)
    await page.evaluate(() => {
      const carry = document.querySelector('.capyui-carry')
      if (carry) carry.click(); else document.querySelector('.capyui-go').click()
    })
    await page.waitForTimeout(5500)
    return page.evaluate(() => {
      const g = window.__capy
      const bs = ['quay', 'venice', 'cave']
      const zs = {}
      for (const b of bs) {
        const p = g.physics.keepOut(b)
        zs[b] = p ? p.body.position.z : null
      }
      return { started: g.state.started, biome: g.biome.current, zs, keptAt: g.state.qaKeptAt ? g.state.qaKeptAt() : null }
    })
  }

  // three different earn orders over the same three chapters (3=?, 10=?, 16=?)
  out.orderA = await bootWith({ 3: 5000, 10: 1000, 16: 3000 })   // earn order: 10, 16, 3
  out.orderB = await bootWith({ 3: 1000, 10: 3000, 16: 5000 })   // earn order: 3, 10, 16 (matches chapter order)
  out.orderC = await bootWith({ 3: 3000, 10: 5000, 16: 1000 })   // earn order: 16, 3, 10

  // ---- the cut path: noRemember reverts to chapter order regardless -------
  // orderC leaves the game in sydney; cross OUT then back IN so sysShelfStage
  // (gated on the biome:enter payload) actually re-runs rather than no-op.
  await page.evaluate(() => { window.__capy.state.noRemember = true; window.__capy.hud.cross('quay') })
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.cross('sydney') })
  await page.waitForTimeout(9000)
  out.cut = await page.evaluate(() => {
    const g = window.__capy
    const bs = ['quay', 'venice', 'cave']
    const zs = {}
    for (const b of bs) { const p = g.physics.keepOut(b); zs[b] = p ? p.body.position.z : null }
    return zs
  })

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow3-x1a-shelf-order', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
