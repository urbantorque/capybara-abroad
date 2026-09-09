async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  // UNDER THE WATER ON THE REEF, which is the condition the row names:
  // "Be under when the water lights up". The bloom's own weight is
  // (0.35 + subT * 0.65), so measuring it at the surface measures a third of it.
  const which = 'BLOOMSTATE'
  await page.evaluate((w) => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    const A = g.palawan, b = g.capy.body
    // find a REEF point: 2.5-4 m of water, which is where the chapter's own
    // task sends you and where the effect measured as a flat whitening
    let px = 0, pz = 0, best = 9
    for (let x = -60; x <= 60; x += 2) for (let z = -60; z <= 40; z += 2) {
      const t = A.terrainHeight(x, z)
      const d = 0 - t
      if (d < 2.4 || d > 4.2) continue
      const e = Math.abs(d - 3.0)
      if (e < best) { best = e; px = x; pz = z }
    }
    window.__b4pt = [px, pz, A.terrainHeight(px, pz)]
    b.position.set(px, -0.2, pz); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0
    const want = w === 'on' ? 1 : 0
    A.bloom = function () { return want }
    // hold E: the dive is a property of the water and it needs the key held
    for (let i = 0; i < 420; i++) { g.input.action = true; g.tick(1 / 60, false) }
    window.__b4state = { pt: window.__b4pt, y: +g.capy.position.y.toFixed(2),
                         diving: !!g.capy.diving, depth: +(g.capy.depth || 0).toFixed(2) }
  }, which)
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)))
  const st = await page.evaluate(() => window.__b4state)
  await page.evaluate(async o => { await fetch('/shot?name=b4-palstate.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, st)
}
