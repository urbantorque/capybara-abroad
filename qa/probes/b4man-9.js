async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    await new Promise(r => setTimeout(r, 1000))
  })
  const spots = { drySand:[0,30], swash:[0,25.2], prom:[30,40], poolDeck:[63,24] }
  const out = { spots: [] }
  for (const k of Object.keys(spots)) {
    out.spots.push(await page.evaluate(async (q) => {
      const g = window.__capy, m = g.manly, capy = g.capy, b = g.capy.body
      b.position.set(q.s[0], m.terrainHeight(q.s[0], q.s[1]) + 0.5, q.s[1])
      b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1/60, false)
      const x0 = capy.position.x, z0 = capy.position.z
      let loaf = 0, wet = 0, depth = 0
      for (let i = 0; i < 900; i++) {
        g.tick(1/60, false)
        if ((capy.loaf||0) > loaf) loaf = capy.loaf
        if ((capy.wet||0) > wet) wet = capy.wet
        if ((capy.depth||0) > depth) depth = capy.depth
      }
      return { at: q.k, secs: 15,
        drift: +Math.hypot(capy.position.x-x0, capy.position.z-z0).toFixed(3),
        loaf: +loaf.toFixed(2), wet: +wet.toFixed(2), depth: +depth.toFixed(2),
        pitch: +m.surfacePitch(capy.position.x, capy.position.z, capy.position.y).toFixed(2) }
    }, { k: k, s: spots[k] }))
  }
  out.swash = await page.evaluate(async () => {
    const g = window.__capy, m = g.manly, capy = g.capy, b = g.capy.body
    b.position.set(0, m.terrainHeight(0, 33) + 0.5, 33); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1/60, false)
    capy.wet = 0
    let wadeWet = 0, maxD = 0, swam = false, wadeTicks = 0
    for (let i = 0; i < 1500; i++) {
      b.position.z -= 0.014
      g.tick(1/60, false)
      const d = capy.depth || 0
      if (d > maxD) maxD = d
      if (capy.swimming) { swam = true; break }
      if (d > 0.04) { wadeTicks++; if ((capy.wet||0) > wadeWet) wadeWet = capy.wet }
    }
    return { wetAfterWadingOnly: +wadeWet.toFixed(2), wadeTicks: wadeTicks,
             maxDepthWading: +maxD.toFixed(2), reachedSwim: swam,
             endZ: +capy.position.z.toFixed(1),
             publishesSoaking: typeof m.soaking === 'function' }
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-9.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
