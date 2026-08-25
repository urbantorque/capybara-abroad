async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('manly'); await sleep(400)
    const sp = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 90; i++) g.tick(1/60, false)
    const m = g.manly, o = {}
    // ---- PILLAR 2: the mischief chains, manly only ----
    const L = g.locals.filter(r => r.biome === 'manly')
    const walkers = L.filter(r => r.fig)
    const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
      (!p.biome || p.biome === 'manly') && p.mass > 0 && p.mass <= 12)
    const owners = new Set(); const pairs = []
    for (const p of props) { let best = null, bd = 121
      for (const r of walkers) { const dx = p.homeX - r.ax, dz = p.homeZ - r.az
        const d2 = dx*dx + dz*dz; if (d2 < bd) { bd = d2; best = r } }
      if (best) { pairs.push({ type: p.type, d: +Math.sqrt(bd).toFixed(1) }); owners.add(best) } }
    let pairsNear = 0
    for (let i = 0; i < L.length; i++) for (let j = i+1; j < L.length; j++) {
      const dx = L[i].x-L[j].x, dz = L[i].z-L[j].z
      if (dx*dx + dz*dz < 400) pairsNear++ }
    o.mischief = { locals: L.length, walkers: walkers.length, nProps: props.length,
      owned: pairs.length, owners: owners.size, pairsNear: pairsNear, sample: pairs.slice(0,6) }
    o.localsHaveFig = L.map(r => ({ x:+r.x.toFixed(0), z:+r.z.toFixed(0), fig: !!r.fig,
      group: !!r.group, onTask: r.onTask ? Object.keys(r.onTask).length : 0,
      lines: (r.lines||[]).length, wheek: (r.wheekLines||[]).length }))
    // ---- PILLAR 5: 20 m cells over the route corridor ----
    // the route: ferry landing / spawn (0,46) -> Corso (0,60) -> beach -> water
    const root = g.scene.getObjectByName('manly')
    const pts = []
    root.traverse(n => { if (n.isMesh || n.isInstancedMesh || n.isPoints) {
      n.updateWorldMatrix(true, false)
      pts.push([n.matrixWorld.elements[12], n.matrixWorld.elements[14], n.isInstancedMesh ? (n.count||1) : 1]) } })
    o.meshes = pts.length
    const cells = {}
    const CELL = 20
    for (const p of pts) { const k = Math.floor(p[0]/CELL)+','+Math.floor(p[1]/CELL)
      cells[k] = (cells[k]||0) + p[2] }
    // walk the actual corridor: spawn -> corso -> back down the beach -> waterline
    const route = []
    for (let z = 62; z >= -6; z -= 4) route.push([0, z])
    for (let x = 4; x <= 84; x += 4) route.push([x, 26 - x*0.5])
    const dead = []
    for (const r of route) { const k = Math.floor(r[0]/CELL)+','+Math.floor(r[1]/CELL)
      if (!dead.some(d => d.k === k)) dead.push({ k: k, at: [r[0], +r[1].toFixed(0)], n: cells[k]||0 }) }
    o.routeCells = dead
    o.deadCells = dead.filter(d => d.n === 0)
    // landmark visibility from the spawn: is each one drawn and above the terrain?
    o.landmarks = {}
    for (const k of ['beach','flags','pines','club','rip','bank','bommie','pool','shelly','castle','boat']) {
      const v = typeof m[k] === 'function' ? m[k]() : m[k]
      if (!v) { o.landmarks[k] = null; continue }
      o.landmarks[k] = { x: +v.x.toFixed(1), z: +v.z.toFixed(1),
        dFromSpawn: +Math.hypot(v.x - sp.x, v.z - sp.z).toFixed(1) }
    }
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-5.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
