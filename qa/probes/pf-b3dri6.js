async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy, R = {}
    g.biome.switchTo('drift')
    const sp = g.biome.spawnOf('drift'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current, d = g.drift
    // ---- AUTO LOAF -------------------------------------------------------
    let loafT = -1
    for (let s = 0; s < 60 && loafT < 0; s++) {
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      if (g.capy.loaf) loafT = +((s + 1) * 0.5).toFixed(1)
    }
    R.loafAfter = loafT
    // ---- OWNERSHIP, if the scatter moved onto the jetty traveller ---------
    const props = g.props.filter(p => !p.removed && (!p.biome || p.biome === live))
    const mug = props.filter(p => p.type === 'mug')[0]
    R.before = { owners: g.locals.filter(r => r.biome === live && r.own).length }
    if (mug) {
      mug.homeX = 18; mug.homeZ = 34
      mug.body.wakeUp()
      mug.body.position.set(18, d.terrainHeight(18, 34) + 0.4, 34)
      mug.body.previousPosition.copy(mug.body.position)
      mug.body.interpolatedPosition.copy(mug.body.position)
      mug.body.velocity.set(0, 0, 0)
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      // knock it 3 m off home, which is what arms a retrieval
      mug.body.wakeUp()
      mug.body.position.set(15, d.terrainHeight(15, 34) + 0.4, 34)
      mug.body.previousPosition.copy(mug.body.position)
      mug.body.interpolatedPosition.copy(mug.body.position)
      const trav = g.locals.filter(r => r.biome === live && Math.abs(r.ax - 26.4) < 1)[0]
      R.travFound = !!trav
      let walked = 0, ownSeen = false
      const x0 = trav ? trav.x : 0, z0 = trav ? trav.z : 0
      for (let s = 0; s < 60; s++) {
        for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
        if (trav && trav.own) ownSeen = true
        if (trav) walked = Math.max(walked, Math.hypot(trav.x - x0, trav.z - z0))
      }
      R.ownSeen = ownSeen
      R.travWalked = +walked.toFixed(2)
      R.mugEnd = { x: +mug.body.position.x.toFixed(1), z: +mug.body.position.z.toFixed(1) }
    }
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
