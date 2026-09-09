async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const a = g.antarctic
    const T = (x, z) => +a.terrainHeight(x, z).toFixed(2)
    const S = (x, z) => +a.groundSlip(x, z).toFixed(2)
    const W = a.waterLevel
    const r = {}
    r.water = W
    r.spawn = g.biome.spawnOf('antarctic')
    r.spawnGround = T(r.spawn.x, r.spawn.z)
    r.marks = {
      huts: [T(a.huts.x, a.huts.z), S(a.huts.x, a.huts.z)],
      colony: [T(a.colony.x, a.colony.z), S(a.colony.x, a.colony.z)],
      jettyRoot: [T(0, 34), T(0, 3)],
      berth: T(5.4, 8),
      whalers: [T(a.whalers.x, a.whalers.z), S(a.whalers.x, a.whalers.z)],
      bones: [T(a.bones.x, a.bones.z), S(a.bones.x, a.bones.z)],
      glacierToe: [T(a.glacierToe.x, a.glacierToe.z), S(a.glacierToe.x, a.glacierToe.z)],
      blueIce: [T(a.blueIce.x, a.blueIce.z), S(a.blueIce.x, a.blueIce.z)],
      highTop: [T(a.highTop.x, a.highTop.z), S(a.highTop.x, a.highTop.z)],
      berg: T(a.berg.x, a.berg.z),
    }
    // the highway, top to bottom: height and slip along it
    r.highway = []
    for (let i = 0; i <= 10; i++) {
      const u = i / 10
      const seg = Math.min(2, Math.floor(u * 3)), t = u * 3 - seg
      const H = [24, 92, 18, 74, 12, 58, 6, 42]
      const x = H[seg * 2] + (H[seg * 2 + 2] - H[seg * 2]) * t
      const z = H[seg * 2 + 1] + (H[seg * 2 + 3] - H[seg * 2 + 1]) * t
      r.highway.push([+x.toFixed(0), +z.toFixed(0), T(x, z), S(x, z)])
    }
    // the glacier fall line, top to sea
    r.glacier = []
    for (let x = -190; x <= -80; x += 10) r.glacier.push([x, T(x, -110), S(x, -110)])
    // the snow shoulder beside it, which has to be climbable
    r.shoulder = []
    for (let x = -190; x <= -80; x += 20) r.shoulder.push([x, T(x, -40), S(x, -40)])
    // the gate: how wide is the fairway at z = -336
    r.gate = []
    for (let x = -212; x <= 212; x += 8) if (T(x, -336) > W) r.gate.push(x)
    r.gateOpen = (() => { let a2 = null, b2 = null;
      for (let x = -212; x <= 212; x += 4) { if (T(x, -336) <= W) { if (a2 === null) a2 = x; b2 = x } }
      return [a2, b2] })()
    // the lead: where the open water is at a few latitudes
    r.lead = []
    for (const z of [-40, -140, -240, -340, -440]) {
      let best = -1, bx = 0
      for (let x = -200; x <= 200; x += 4) { const d = 1 - a.packAt(x, z); if (d > best) { best = d; bx = x } }
      r.lead.push([z, bx, +(1 - best).toFixed(2)])
    }
    // the floes and the boat
    r.boat = [+a.boat.position.x.toFixed(1), +a.boat.position.z.toFixed(1),
              T(a.boat.position.x, a.boat.position.z)]
    r.floeNear = (() => { const q = a.nearestFloe(); return [+q.x.toFixed(1), +q.z.toFixed(1)] })()
    // can the tender reach the arch, the glacier toe and the whalers' beach?
    r.reach = {}
    const path = (x0, z0, x1, z1) => {
      let blocked = 0
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t
        if (T(x, z) > W - 0.35) blocked++
      }
      return blocked
    }
    r.reach.toGate = path(5.4, 8, 0, -336)
    r.landAtJetty = [T(0, 41), T(0, 30), T(0, 3)]
    r.reach.toBerg = path(0, -336, a.berg.x, a.berg.z + 40)
    r.reach.toGlacier = path(5.4, 8, a.glacierToe.x + 8, a.glacierToe.z)
    r.reach.toWhalers = path(5.4, 8, a.whalers.x - 30, a.whalers.z - 30)
    return r
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antgeom.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
