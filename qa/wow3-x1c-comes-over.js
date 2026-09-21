async page => {
  // ROADMAP-WOW3 X1c — THE COMPANION THAT COMES OVER. Two kinds, live end to
  // end: boot already carrying it (W6's own save-forced-stow pattern, same
  // as qa/wow3-d7-homecoming.js), cross into its own `from` chapter so
  // compLeave(..., 'home') actually fires and it walks off and clears
  // (compObj -> null, compWentHome[kind] set), then teleport the animal to
  // within compHOME_NEAR of compHOME[kind] (systems.js) and confirm
  // stowDebug() picks the kind back up on its own — the SAME compTake ->
  // 'follow' beat the restore branch already uses, not a forced pickup.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })

  const HOME = { pigeon: { x: 12, z: -17 }, heron: { x: 48, z: -6 } }
  const KINDS = [['pigeon', 'venice'], ['heron', 'kyoto']]
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

    // cross INTO its own home chapter (ibis/sydney is already there at boot,
    // the others need a real crossing) so compLeave('home') fires for real
    if (biome !== 'sydney') {
      await page.evaluate((n) => window.__capy.hud.cross(n), biome)
      await page.waitForFunction((n) => window.__capy.biome.current === n, biome, { timeout: 60000, polling: 300 })
    }
    // the walk-off is compLEAVE (2.4s); give it real margin to clear
    await page.waitForTimeout(4200)
    rec.afterHome = await page.evaluate(() => window.__capy.stowDebug())

    // teleport the animal within compHOME_NEAR (8m) of compHOME[kind]
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
    // a second read, further out, confirms it did not just flicker once
    await page.waitForTimeout(1500)
    rec.settled = await page.evaluate(() => window.__capy.stowDebug())

    out.rows[kind] = rec
  }

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow3-x1c-comes-over', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
