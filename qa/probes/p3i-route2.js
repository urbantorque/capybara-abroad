async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(700)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__capy.biome.switchTo('iceland') })
  await page.waitForTimeout(2500)
  // ---- measure REAL walking speed on the flat, with real keys -------------
  await page.evaluate(() => {
    const g = window.__capy, b = g.capy.body
    b.position.set(0, 2.0, 40); b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position); b.velocity.set(0, 0, 0)
    g.input.camYaw = 0
    window.__S = { p0: null, sp: [] }
  })
  await page.waitForTimeout(800)
  await page.keyboard.down('w')
  await page.waitForTimeout(500)
  await page.evaluate(() => { const g = window.__capy; window.__S.p0 = { x: g.capy.position.x, z: g.capy.position.z, t: performance.now() } })
  await page.waitForTimeout(4000)
  const walk = await page.evaluate(() => {
    const g = window.__capy, S = window.__S, p = g.capy.position
    return { d: Math.hypot(p.x - S.p0.x, p.z - S.p0.z), s: (performance.now() - S.p0.t) / 1000,
             vel: Math.hypot(g.capy.velocity.x, g.capy.velocity.z) }
  })
  await page.keyboard.up('w')
  // ---- sprint (shift) ------------------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy, b = g.capy.body
    b.position.set(0, 2.0, 40); b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position); b.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(600)
  await page.keyboard.down('Shift'); await page.keyboard.down('w')
  await page.waitForTimeout(700)
  await page.evaluate(() => { const g = window.__capy; window.__S.p1 = { x: g.capy.position.x, z: g.capy.position.z, t: performance.now() } })
  await page.waitForTimeout(4000)
  const run = await page.evaluate(() => {
    const g = window.__capy, S = window.__S, p = g.capy.position
    return { d: Math.hypot(p.x - S.p1.x, p.z - S.p1.z), s: (performance.now() - S.p1.t) / 1000,
             vel: Math.hypot(g.capy.velocity.x, g.capy.velocity.z) }
  })
  await page.keyboard.up('w'); await page.keyboard.up('Shift')
  const out = await page.evaluate(o => {
    const g = window.__capy, THREE = g.THREE, i = g.iceland
    const R = { walk: o.walk, run: o.run }
    const box = new THREE.Box3(), v = new THREE.Vector3(), sz = new THREE.Vector3()
    const solid = [], scatter = []
    g.scene.traverse(ob => {
      if (!(ob.isMesh || ob.isInstancedMesh)) return
      for (let p = ob; p; p = p.parent) if (!p.visible) return
      if (ob === g.capy.group) return
      try {
        box.setFromObject(ob); box.getSize(sz); box.getCenter(v)
        const r = Math.max(sz.x, sz.z) * 0.5
        const rec = { x: v.x, z: v.z, r, h: sz.y, n: ob.name || (ob.geometry && ob.geometry.type) || '?',
                      c: ob.isInstancedMesh ? ob.count : 1 }
        if (ob.isInstancedMesh) { if (r < 200) scatter.push(rec) }
        else if (r < 90 && sz.y > 0.8) solid.push(rec)
      } catch (e) {}
    })
    R.nSolid = solid.length; R.nScatter = scatter.length
    // dead-cell audit along the town->cairn corridor, 10 m cells, 20 m radius,
    // counting only NON-SCATTER meshes taller than 0.8 m
    const corridor = []
    for (let z = 110; z >= -190; z -= 10) {
      // the corridor is not straight: it runs down the middle of the valley
      // then up the moraine. sample the nearest sensible x for that z.
      const x = z > -70 ? 0 : 34
      let n = 0, names = {}
      for (const s of solid) {
        const dx = s.x - x, dz = s.z - z
        if (dx * dx + dz * dz < (20 + s.r) * (20 + s.r)) { n++; names[s.n] = (names[s.n] || 0) + 1 }
      }
      corridor.push({ z, x, n, names: Object.keys(names).slice(0, 4).join(',') })
    }
    R.corridor = corridor
    // and what NPC / prop / local life is on it
    R.npcs = (g.npcs || []).filter(n => n.biome === 'iceland')
      .map(n => ({ x: +(n.x !== undefined ? n.x : (n.group && n.group.position.x) || 0).toFixed(0),
                   z: +(n.z !== undefined ? n.z : (n.group && n.group.position.z) || 0).toFixed(0),
                   k: n.kind || n.type || 'npc' }))
    R.nNpc = R.npcs.length
    R.props = (g.props || []).filter(p => p.biome === 'iceland')
      .map(p => ({ id: p.id, x: +(p.body ? p.body.position.x : 0).toFixed(0), z: +(p.body ? p.body.position.z : 0).toFixed(0) }))
    // ---- ride candidates: every non-scatter mesh in the valley / moraine ----
    R.rides = solid.filter(s => s.z < 70 && s.z > -200 && s.h > 0.9 && s.r > 0.8)
      .map(s => ({ n: s.n, x: +s.x.toFixed(0), z: +s.z.toFixed(0), r: +s.r.toFixed(1), h: +s.h.toFixed(1) }))
      .sort((a, b) => b.z - a.z)
    return R
  }, { walk, run })
  await page.evaluate(async o => {
    await fetch('/shot?name=p3iroute2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
