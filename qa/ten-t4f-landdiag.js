async page => {
  // T4f: the landing as the player gets it, twice per arm. Drop into open
  // cloud 12 s after arrival (the card gone) from 14 m; shoot at +0.45 s (the
  // splash) and +1.9 s (the bloom has gathered: driBLOOM_WAIT is 1.15 s).
  // Live first, then with noCloudSoft set, at the same two points.
  const NAME = 'ten-t4f-landdiag'
  const PORT = 5196
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('drift') })
  let t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    const ok = await page.evaluate(() => { const g = window.__capy; if (g.biome.current !== 'drift' || !g.drift) return false; const s = g.drift.SPAWN, p = g.capy.position; return Math.hypot(p.x - s.x, p.z - s.z) < 5 })
    if (ok) break
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(12000)
  for (const arm of ['on', 'off']) {
    await page.evaluate(off => { window.__capy.state.noCloudSoft = off }, arm === 'off')
    for (const P of [{ x: 28, z: 57, t: 'a' }, { x: -40, z: 10, t: 'b' }]) {
      await page.evaluate(P => { const b = window.__capy.capy.body; b.position.set(P.x, 14, P.z); b.velocity.set(0, -2, 0); b.aabbNeedsUpdate = true }, P)
      t0 = Date.now()
      while (Date.now() - t0 < 8000) { if (await page.evaluate(() => window.__capy.capy.position.y) < 0.6) break; await page.waitForTimeout(60) }
      await page.waitForTimeout(450)
      await page.screenshot({ path: 'qa/' + NAME + '-' + arm + '-' + P.t + '1.png' })
      await page.waitForTimeout(1200)
      out[arm + P.t] = await page.evaluate(() => { const g = window.__capy, c = g.camera.position, cs = g.drift.cloudSoft(); return { cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], soft: cs.soft, bank: cs.bankSoft, low: cs.lowOn, rung: g.state.perfRung } })
      await page.screenshot({ path: 'qa/' + NAME + '-' + arm + '-' + P.t + '2.png' })
      await page.waitForTimeout(5000)
    }
  }
  await page.evaluate(() => { window.__capy.state.noCloudSoft = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
