async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { issues: [] }
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const api = g.manly
    const P = (x, z, y) => api.surfacePitch ? +api.surfacePitch(x, z, y === undefined ? 1 : y).toFixed(2) : null
    R.surf = { sand: P(0, 30), prom: P(0, 60), rockHeadland: P(70, -50),
               shelly: P(84, -20), poolFloor: P(71, 15), poolDeck: P(62.5, 24.6) }
    // the whole-map histogram, so a blanket row cannot hide
    const seen = {}
    for (let x = -130; x <= 138; x += 4)
      for (let z = -110; z <= 98; z += 4) {
        const v = P(x, z); if (v == null) continue
        seen[v] = (seen[v] || 0) + 1
      }
    R.hist = seen
    // the pair
    const locs = (g.npc && g.npc.locals) ? g.npc.locals() : null
    R.localApi = !!locs
    R.err = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-manfix.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
