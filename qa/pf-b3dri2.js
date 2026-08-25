async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('drift')
    const sp = g.biome.spawnOf('drift'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current
    const d = g.drift
    // ---- KEELS: does driTerrain ever answer below an island top? ----------
    // sample a grid over the whole world and compare to the analytic top
    let keelHits = 0, samples = 0, minY = 1e9
    const th = []
    for (let x = -210; x <= 210; x += 6) {
      for (let z = -270; z <= 120; z += 6) {
        const y = d.terrainHeight(x, z)
        samples++
        if (y < minY) minY = y
        if (!d.isOverWater(x, z)) th.push(+y.toFixed(1))
      }
    }
    R.keel = { samples, minY: +minY.toFixed(2), landSamples: th.length,
      distinctTops: Array.from(new Set(th)).sort((a, c) => a - c).slice(0, 40) }
    // ---- GUST: how far does a light prop actually travel? ------------------
    const props = g.props.filter(p => !p.removed && (!p.biome || p.biome === live))
    const mug = props.filter(p => p.type === 'mug')[0]
    const bowl = props.filter(p => p.type === 'cuencobowl')[0]
    R.gust = []
    for (const p of [mug, bowl]) {
      if (!p) continue
      const x0 = p.homeX, z0 = p.homeZ
      p.body.wakeUp()
      p.body.position.set(x0, d.terrainHeight(x0, z0) + 0.5, z0)
      p.body.previousPosition.copy(p.body.position)
      p.body.interpolatedPosition.copy(p.body.position)
      p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
      let far = 0
      for (let s = 0; s < 40; s++) {
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
        const dd = Math.hypot(p.body.position.x - x0, p.body.position.z - z0)
        if (dd > far) far = dd
      }
      R.gust.push({ t: p.type, m: p.mass, maxDrift: +far.toFixed(2),
        end: +Math.hypot(p.body.position.x - x0, p.body.position.z - z0).toFixed(2) })
    }
    // ---- OWNERSHIP: candidate scatter centres ------------------------------
    const T = { x: 26.4, z: 32.8 }        // the jetty traveller
    function tryCentre(cx, cz, r0, r1) {
      let ok = 0, own = 0
      for (let k = 0; k < 400; k++) {
        const a = Math.random() * 6.283, r = r0 + Math.random() * (r1 - r0)
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
        if (d.isOverWater(x, z)) continue
        if (d.navBlocked && d.navBlocked(x, z, 0.4)) continue
        if (Math.abs(d.terrainHeight(x, z) - 30) > 0.6) continue   // must be the Shelf top
        ok++
        if (Math.hypot(x - T.x, z - T.z) <= 11) own++
      }
      return { c: cx + ',' + cz, r: r0 + '-' + r1, valid: ok, within11: own,
        pct: ok ? +(own / ok * 100).toFixed(0) : 0 }
    }
    R.centres = [tryCentre(2, 42, 5, 20), tryCentre(14, 34, 3, 9),
                 tryCentre(16, 34, 2, 8), tryCentre(17, 33, 2, 7),
                 tryCentre(13, 30, 3, 9), tryCentre(-13, 33, 3, 9)]
    // ---- SURFACE: what kinds are on the route -----------------------------
    R.shelfTop = +d.terrainHeight(0, 30).toFixed(2)
    R.anvilTop = +d.terrainHeight(-38, -47).toFixed(2)
    R.archTop = +d.terrainHeight(3, -103).toFixed(2)
    R.crownTop = +d.terrainHeight(36, -184).toFixed(2)
    // ---- TRIANGLES --------------------------------------------------------
    if (g.renderer && g.renderer.info) R.tris = g.renderer.info.render.triangles
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
