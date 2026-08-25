async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    const k = g.kyoto, r = {}
    r.calmAudit = g.hud && g.hud.calmAudit ? g.hud.calmAudit() : null
    r.roomAudit = g.hud && g.hud.roomAudit ? g.hud.roomAudit() : null
    r.mapAudit = g.hud && g.hud.mapMarkAudit ? g.hud.mapMarkAudit() : null
    // ---- the six stepping stones, measured -------------------------------
    const stones = []
    for (let i = 0; i < 6; i++) {
      const sx = 30 - 9 - i * 2.6, sz = -12 - 8 + Math.sin(i * 1.3) * 1.6
      stones.push({ i, x: +sx.toFixed(2), z: +sz.toFixed(2),
        overWater: k.isOverWater(sx, sz), ground: +k.terrainHeight(sx, sz).toFixed(2) })
    }
    for (let i = 1; i < 6; i++) {
      stones[i].gapPrev = +Math.hypot(stones[i].x - stones[i - 1].x, stones[i].z - stones[i - 1].z).toFixed(2)
    }
    r.stones = stones
    // stone 0 to the payout circle (9 m of kyoPAVILION 30,-12)
    r.stone0ToIsland = +Math.hypot(stones[0].x - 30, stones[0].z + 12).toFixed(2)
    r.stone5ToIsland = +Math.hypot(stones[5].x - 30, stones[5].z + 12).toFixed(2)
    // is there dry ground between stone0 and the payout circle? sample the line
    r.islandLine = []
    for (let t = 0; t <= 10; t++) {
      const px = stones[0].x + (30 - stones[0].x) * t / 10
      const pz = stones[0].z + (-12 - stones[0].z) * t / 10
      r.islandLine.push({ t, d: +Math.hypot(px - 30, pz + 12).toFixed(1),
        w: k.isOverWater(px, pz) ? 1 : 0, h: +k.terrainHeight(px, pz).toFixed(2) })
    }
    // ---- footfall surface along the whole route --------------------------
    const RT = [['spawn', -16, 52], ['gion', -4, 52], ['bell', -15, 24], ['zen', -34, 8],
                ['pond N', 26, -22], ['stone3', 13.2, -19.6], ['pavilion', 30, -12],
                ['heronA', 48, -6], ['toriiStart', k.toriiStart.x, k.toriiStart.z],
                ['bamboo', -84, -44], ['bridge', k.bridge.x, k.bridge.z],
                ['river mid', 30, 150], ['mill', k.mill.x, k.mill.z],
                ['uji st', k.uji.x - 10, k.uji.z], ['bowl', k.bowl.x, k.bowl.z],
                ['matcha', k.matchaHeap.x, k.matchaHeap.z], ['terrace', 99.5, 179]]
    r.route = RT.map(e => {
      const zn = []
      for (const n of ['gion', 'zen', 'bamboo', 'uji', 'torii', 'pond', 'river', 'street', 'terrace'])
        { try { if (k.inZone(n, e[1], e[2])) zn.push(n) } catch (x) {} }
      let pitch = 0.82
      if (k.inZone('gion', e[1], e[2])) pitch = 1.0
      else if (k.inZone('zen', e[1], e[2])) pitch = 0.86
      else if (e[2] < -40 && e[2] > -140) pitch = 1.0
      return { n: e[0], x: +e[1].toFixed(1), z: +e[2].toFixed(1),
        h: +k.terrainHeight(e[1], e[2]).toFixed(2), w: k.isOverWater(e[1], e[2]) ? 1 : 0,
        pitch, zones: zn.join('|') }
    })
    // ---- world extents and scenery density -------------------------------
    let n = 0, minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9
    const cells = Object.create(null)
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      o.getWorldPosition(window.__v || (window.__v = new g.THREE.Vector3()))
      const p = window.__v
      if (!isFinite(p.x)) return
      n++
      if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x
      if (p.z < minz) minz = p.z; if (p.z > maxz) maxz = p.z
    })
    r.meshes = n
    r.lastError = g.state && g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return r
  })
  await page.evaluate((o) => fetch('/shot?name=p3k2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}