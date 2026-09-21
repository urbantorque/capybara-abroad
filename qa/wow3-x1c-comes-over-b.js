async page => {
  // ROADMAP-WOW3 W5 — X1c extended: the four remaining kinds
  // (cat/goreme, silver gull/manly, gentoo/antarctic, ibis/sydney), the
  // exact same pattern qa/wow3-x1c-comes-over.js already proved live for
  // pigeon/heron: boot already carrying it, cross into its own `from`
  // chapter so compLeave(..., 'home') fires and clears, teleport within
  // compHOME_NEAR (8m) of compHOME[kind] (systems.js), confirm stowDebug()
  // picks it back up on its own via the ordinary compTake -> 'follow' beat.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })

  // compHOME, read from systems.js ~line 43165
  const HOME = { 'cat': { x: 0, z: 34 }, 'silver gull': { x: -13.5, z: 47.0 }, 'gentoo': { x: 24, z: 92 }, 'ibis': { x: -10.0, z: 12.6 } }
  const KINDS = [['cat', 'goreme'], ['silver gull', 'manly'], ['gentoo', 'antarctic'], ['ibis', 'sydney']]
  const out = { errs, rows: {} }

  for (const [kind, biome] of KINDS) {
    await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForTimeout(2500)
    await page.evaluate(() => document.querySelector('.capyui-go').click())
    await page.waitForTimeout(2500)
    const tid = (await page.evaluate(() => (window.__capy.tasksInChapter(1) || [])[0])) || 'wheek-sydney'

    await page.addInitScript((o) => {
      try {
        localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: [o.tid], seen: [1], recs: {}, ms: 0, stow: { kind: o.kind, from: o.biome } }))
      } catch (e) {}
    }, { tid, kind, biome })
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForTimeout(1800)
    await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); if (c) c.click(); else document.querySelector('.capyui-go').click() })
    await page.waitForTimeout(1800)
    const rec = { biome, kind }
    rec.atBoot = await page.evaluate(() => window.__capy.stowDebug())

    if (biome !== 'sydney') {
      await page.evaluate((n) => window.__capy.hud.cross(n), biome)
      await page.waitForFunction((n) => window.__capy.biome.current === n, biome, { timeout: 60000, polling: 300 })
    }
    await page.waitForTimeout(4200)
    rec.afterHome = await page.evaluate(() => window.__capy.stowDebug())

    const home = HOME[kind]
    rec.teleport = await page.evaluate((h) => {
      const g = window.__capy
      const gy = (g.biome && g[g.biome.current] && g[g.biome.current].terrainHeight)
        ? g[g.biome.current].terrainHeight(h.x + 3, h.z) : 1
      g.capy.body.position.set(h.x + 3, gy + 0.6, h.z)
      return { x: h.x + 3, y: gy + 0.6, z: h.z }
    }, home)
    await page.waitForTimeout(2000)
    rec.afterApproach = await page.evaluate(() => window.__capy.stowDebug())
    await page.waitForTimeout(1500)
    rec.settled = await page.evaluate(() => window.__capy.stowDebug())

    out.rows[kind] = rec
  }

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow3-x1c-comes-over-b', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
