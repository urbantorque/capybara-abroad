async page => {
  await page.waitForTimeout(500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(1500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('pantanal'); await sleep(600)
    const sp = g.biome.spawnOf('pantanal'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 90; i++) g.tick(1/60, false)
    const m = g.pantanal, o = {}
    // ---- PILLAR 2: mischief ----
    const L = (g.locals || []).filter(r => r.biome === 'pantanal')
    const walkers = L.filter(r => r.fig)
    const props = (g.props||[]).filter(p => !p.removed && !p.hidden && !p.keep &&
      (!p.biome || p.biome === 'pantanal') && p.mass > 0 && p.mass <= 12)
    const owners = new Set(); const pairs = []
    for (const p of props) { let best = null, bd = 121
      for (const r of walkers) { const dx = p.homeX - r.ax, dz = p.homeZ - r.az
        const d2 = dx*dx + dz*dz; if (d2 < bd) { bd = d2; best = r } }
      if (best) { pairs.push({ type: p.type, d: +Math.sqrt(bd).toFixed(1) }); owners.add(best) } }
    // and the nearest walker to every prop, whether or not it is inside 11 m
    const nearest = props.map(p => { let bd = 1e9
      for (const r of walkers) bd = Math.min(bd, Math.hypot(p.homeX - r.ax, p.homeZ - r.az))
      return +bd.toFixed(1) })
    let pairsNear = 0, pairs13 = 0
    for (let i = 0; i < L.length; i++) for (let j = i+1; j < L.length; j++) {
      const d = Math.hypot(L[i].x-L[j].x, L[i].z-L[j].z)
      if (d < 20) pairsNear++
      if (d < 13) pairs13++ }
    o.mischief = { locals: L.length, walkers: walkers.length, nProps: props.length,
      owned: pairs.length, owners: owners.size, chainPairs20: pairsNear, chatPairs13: pairs13,
      nearestWalker: nearest }
    o.localsHaveFig = L.map(r => ({ x:+r.x.toFixed(0), z:+r.z.toFixed(0), fig: !!r.fig,
      onTask: r.onTask ? Object.keys(r.onTask).length : 0, lines: (r.lines||[]).length }))
    // ---- PILLAR 5: 20 m cells over the route ----
    const root = g.scene.getObjectByName('pantanal')
    const pts = []
    root.traverse(n => { if (n.isMesh || n.isInstancedMesh || n.isPoints) {
      n.updateWorldMatrix(true, false)
      if (n.isInstancedMesh) {
        const a = n.instanceMatrix.array
        for (let i = 0; i < n.count; i++) pts.push([a[i*16+12], a[i*16+14], 1])
      } else if (n.geometry) {
        if (!n.geometry.boundingSphere) n.geometry.computeBoundingSphere()
        const c = n.geometry.boundingSphere.center
        pts.push([n.matrixWorld.elements[12] + c.x, n.matrixWorld.elements[14] + c.z, 1])
      }
    } })
    o.pts = pts.length
    const cells = {}, CELL = 20
    for (const p of pts) { const k = Math.floor(p[0]/CELL)+','+Math.floor(p[1]/CELL)
      cells[k] = (cells[k]||0) + p[2] }
    const route = []
    for (let z = 62; z >= -50; z -= 4) route.push([m.roadX ? 0 : 0, z])
    for (let z = -50; z >= -90; z -= 4) route.push([-34, z])
    const seen = []
    for (const r of route) { const k = Math.floor(r[0]/CELL)+','+Math.floor(r[1]/CELL)
      if (!seen.some(d => d.k === k)) seen.push({ k: k, at: [+r[0].toFixed(0), +r[1].toFixed(0)], n: cells[k]||0 }) }
    o.routeCells = seen
    o.deadCells = seen.filter(d => d.n < 3)
    // ---- PILLAR 3: stillness by displacement, two points ----
    const still = []
    for (const pt of [[0, 62], [-34, -46]]) {
      const h = m.terrainHeight(pt[0], pt[1])
      b.position.set(pt[0], h + 0.6, pt[1]); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 30; i++) g.tick(1/60, false)
      const x0 = b.position.x, z0 = b.position.z, y0 = b.position.y
      for (let i = 0; i < 60*20; i++) g.tick(1/60, false)
      still.push({ at: pt, moved: +Math.hypot(b.position.x-x0, b.position.z-z0).toFixed(3),
                   dy: +(b.position.y-y0).toFixed(3), loaf: g.capy.loaf })
    }
    o.still = still
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4pan-5.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
