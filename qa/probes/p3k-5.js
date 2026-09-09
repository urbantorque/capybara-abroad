async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}

  // ---- A. THE FINISH RE-FIRE, counted -----------------------------------
  out.refire = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const k = g.kyoto, b = g.capy.body
    let chime = 0, rec = []
    const s0 = g.sfx.bind(g); g.sfx = function (n, o) { if (n === 'chime' && o && o.volume === 1) chime++; return s0(n, o) }
    const r0 = g.record ? g.record.bind(g) : null
    if (r0) g.record = function (id, v) { rec.push({ id, v: +Number(v).toFixed(2) }); return r0(id, v) }
    // park in the mill pond, floating, and do nothing
    const y = k.waterHeightAt(k.mill.x - 3, k.mill.z - 6) + 0.05
    b.position.set(k.mill.x - 3, y, k.mill.z - 6); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await new Promise(r => setTimeout(r, 12000))
    return { chimesIn12s: chime, records: rec.slice(0, 8), nRecords: rec.length,
      runBest: k.runBest(), runTime: k.runTime(), done: !!g.taskDone('uji-run') }
  })

  // ---- B. THE HERON, and the inverted approach --------------------------
  out.heron = await page.evaluate(async () => {
    const g = window.__capy, k = g.kyoto, b = g.capy.body
    // stand on the north shore of the pond, 7 m from heron perch A (48,-6)
    const hx = 48, hz = -6
    const px = 48, pz = 2.5
    const gy = k.terrainHeight(px, pz)
    b.position.set(px, gy + 0.6, pz); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const samples = []
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const ca = g.hud.calmAudit()
      const c = ca.critters.find(x => x.live) || {}
      const h = k.heron()
      samples.push({ t: +(i * 1.5).toFixed(1), calm: +ca.calm.toFixed(2), loaf: +ca.loaf.toFixed(2),
        capyLoaf: +(g.capy.loaf || 0).toFixed(2),
        near: +Number(c.near || 0).toFixed(2), appr: +Number(c.appr || 0).toFixed(2),
        hx: +h.x.toFixed(1), hz: +h.z.toFixed(1),
        dFromPerch: +Math.hypot(h.x - hx, h.z - hz).toFixed(1),
        dToCapy: +Math.hypot(h.x - g.capy.position.x, h.z - g.capy.position.z).toFixed(1),
        standing: k.heronStanding() })
    }
    return { capy: { x: px, z: pz, y: +(gy + 0.6).toFixed(2) }, samples }
  })

  // ---- C. THE ISLAND, is it solid ----------------------------------------
  out.island = await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto
    const rows = []
    for (let d = 0; d <= 14; d += 1) {
      // walk out from the pavilion toward stone 0 (21,-20)
      const ux = (21 - 30) / 12.04, uz = (-20 + 12) / 12.04
      const x = 30 + ux * d, z = -12 + uz * d
      // is there a static body under here?
      const A = new g.CANNON.Vec3(x, 6, z), B = new g.CANNON.Vec3(x, -6, z)
      const R = new g.CANNON.RaycastResult(); R.reset()
      let hit = null
      try { g.world.raycastClosest(A, B, { collisionFilterMask: 1, skipBackfaces: true }, R)
            if (R.hasHit) hit = +R.hitPointWorld.y.toFixed(2) } catch (e) {}
      rows.push({ d, x: +x.toFixed(1), z: +z.toFixed(1), ow: k.isOverWater(x, z) ? 1 : 0,
        terr: +k.terrainHeight(x, z).toFixed(2), solidTop: hit })
    }
    return rows
  })

  out.lastError = await page.evaluate(() => { const g = window.__capy; return g.state.lastError ? String(g.state.lastError).slice(0, 200) : null })
  await page.evaluate((o) => fetch('/shot?name=p3k5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}