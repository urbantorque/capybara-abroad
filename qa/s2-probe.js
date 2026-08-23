async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  // ---- QUAY: does the boat collide with anything? ----
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('quay')
  })
  await page.waitForTimeout(1500)
  out.quay = await page.evaluate(() => {
    const g = window.__capy, q = g.quay
    const r = { }
    // drive the boat straight at Fort Denison and at Bradleys Head via api
    r.boatStart = { x: q.boat.position.x, z: q.boat.position.z }
    r.chipTest = typeof q.chipsGone
    // sample terrainHeight and drawn platform on Fort Denison
    r.fortTerr = q.terrainHeight(6, -126)
    r.fortWater = q.isOverWater(6, -126)
    // Bradleys Head: is it water?
    r.bradWater = q.isOverWater(-76, -196)
    r.bradTerr = q.terrainHeight(-76, -196)
    r.northWater = q.isOverWater(236, -498)
    r.pylonWater = q.isOverWater(-59, -58)
    // how many static bodies near the bridge pylons / headlands
    let nearPylon = 0, nearBrad = 0
    for (const b of g.world.bodies) {
      if (b.mass > 0 && b.type !== 4) continue
      b.updateAABB()
      const lo = b.aabb.lowerBound, hi = b.aabb.upperBound
      if (!(lo.x === lo.x)) continue
      if (lo.x < -55 && hi.x > -63 && lo.z < -52 && hi.z > -64) nearPylon++
      if (lo.x < -70 && hi.x > -82 && lo.z < -190 && hi.z > -202) nearBrad++
    }
    r.nearPylonBodies = nearPylon
    r.nearBradBodies = nearBrad
    return r
  })
  // ---- KYOTO: the miller's ground ----
  await page.evaluate(() => { window.__capy.biome.switchTo('kyoto') })
  await page.waitForTimeout(1500)
  out.kyoto = await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto
    const r = {}
    r.mill = { x: k.mill.x, z: k.mill.z }
    r.millTerr = k.terrainHeight(k.mill.x, k.mill.z)
    r.millWater = k.isOverWater(k.mill.x, k.mill.z)
    r.millInRiver = k.inRiver ? 'fn' : 'no'
    // gion lantern: is there anything under the globes?
    r.gionTerr = k.terrainHeight(-46, 52 + 5.4)
    // locals list
    r.locals = (g.npcLocals || []).length
    return r
  })
  // ---- CALI ----
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1500)
  out.cali = await page.evaluate(() => {
    const g = window.__capy, c = g.cali
    const r = {}
    r.floorTerr = c.terrainHeight(c.floor.x, c.floor.z)
    r.routeLen = c.rideProgress ? 1 : 0
    return r
  })
  out.err = await page.evaluate(() => (window.__capy.state.lastError || null))
  await page.evaluate((o) => fetch('/shot?name=s2probe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
