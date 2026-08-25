async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('iceland')
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const I = g.iceland
    // small, near-field objects only: radius under 22 m so terrain / sea / sky
    // sheets and the glacier tongue do not count as "there is something here"
    const pts = []
    const v = new g.THREE.Vector3()
    g.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      const gm = o.geometry
      if (!gm) return
      if (!gm.boundingSphere) { try { gm.computeBoundingSphere() } catch (e) { return } }
      const r = gm.boundingSphere ? gm.boundingSphere.radius : 0
      if (r > 22) return
      o.getWorldPosition(v)
      pts.push([v.x, v.z, r, o.isInstancedMesh ? o.count : 1])
    })
    R.nSmall = pts.length
    const L = (g.locals || []).filter(l => l.biome === 'iceland')
    R.locals = L.map(l => ({ x: +l.x.toFixed(1), z: +l.z.toFixed(1), grp: !!l.group,
      nl: l.lines ? l.lines.length : 0,
      before: l.lines ? l.lines.filter(t => t.before).length : 0,
      after: l.lines ? l.lines.filter(t => t.after).length : 0,
      onTask: l.onTask ? Object.keys(l.onTask).length : 0,
      wheek: l.wheekLines ? l.wheekLines.length : 0 }))
    // pair distances
    const pairs = []
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const d = Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z)
      if (d < 30) pairs.push([i, j, +d.toFixed(1)])
    }
    R.pairs = pairs
    R.exchanges = (g.npc && g.npc.exchanges) ? g.npc.exchanges.length : null
    // walkers
    R.walkers = (g.npcs || []).filter(n => n.biome === 'iceland').length
    R.npcTot = (g.npcs || []).length
    // ---- THE MORAINE CORRIDOR: the actual walk up to glacierTop ----
    const line = []
    for (let z = -70; z >= -190; z -= 10) line.push([34, z])
    // ---- and the walk south from the spring to the moraine foot ----
    for (let z = -10; z >= -80; z -= 10) line.push([0, z])
    R.corridor = line.map(([cx, cz]) => {
      let n = 0, nearest = 999
      for (const p of pts) {
        const d = Math.hypot(p[0] - cx, p[1] - cz) - p[2]
        if (d < 20) n += p[3]
        if (d < nearest) nearest = d
      }
      let np = 0
      for (const l of L) if (Math.hypot(l.x - cx, l.z - cz) < 25) np++
      return { x: cx, z: cz, obj: n, nearest: +nearest.toFixed(1), local: np,
               y: +I.terrainHeight(cx, cz).toFixed(1), slip: +I.groundSlip(cx, cz).toFixed(2) }
    })
    R.pier = I.pier
    R.glacierTop = I.glacierTop
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return R
  })
  out.errs = errs.slice(0, 6)
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
