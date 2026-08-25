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
    // ---- world objects, world-space xz, excluding the terrain/sea sheets ----
    const pts = []
    const v = new g.THREE.Vector3()
    g.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      const gm = o.geometry
      if (!gm || !gm.boundingSphere) { try { gm.computeBoundingSphere() } catch (e) { return } }
      const r = gm.boundingSphere ? gm.boundingSphere.radius : 0
      o.getWorldPosition(v)
      pts.push([+v.x.toFixed(1), +v.z.toFixed(1), +r.toFixed(1), o.isInstancedMesh ? o.count : 1])
    })
    R.nMesh = pts.length
    // ---- npcs and props ----
    R.npcs = (g.npcs || []).filter(n => !n.biome || n.biome === 'iceland')
      .map(n => ({ id: n.id || n.name || '?', x: +(n.x != null ? n.x : (n.position ? n.position.x : 0)).toFixed(1),
                   z: +(n.z != null ? n.z : (n.position ? n.position.z : 0)).toFixed(1) }))
    R.props = (g.props || []).map(p => ({ id: p.id || '?',
      x: +(p.body ? p.body.position.x : 0).toFixed(1), z: +(p.body ? p.body.position.z : 0).toFixed(1),
      own: !!p.own, edible: !!p.edible }))
    // ---- the route ----
    const cat = I.snowcat ? I.snowcat() : null
    const wp = [
      ['spawn', 0, 99],
      ['pylsa', I.pylsa.x, I.pylsa.z],
      ['organ', I.organ.x, I.organ.z],
      ['geysir', I.strokkur.x, I.strokkur.z],
      ['puffins', I.cliff.x, I.cliff.z],
      ['glacierTop', I.glacierTop.x, I.glacierTop.z],
      ['snowcat', cat ? +cat.x.toFixed(1) : null, cat ? +cat.z.toFixed(1) : null],
      ['spring', I.spring.x, I.spring.z],
      ['pier', I.pier.x, I.pier.head],
    ]
    R.wp = wp
    // sample every 20 m along consecutive legs; count "life" within 25 m
    const cells = []
    for (let i = 0; i + 1 < wp.length; i++) {
      const a = wp[i], b = wp[i + 1]
      if (a[1] == null || b[1] == null) continue
      const dx = b[1] - a[1], dz = b[2] - a[2]
      const L = Math.hypot(dx, dz)
      const n = Math.max(1, Math.round(L / 20))
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        const cx = a[1] + dx * t, cz = a[2] + dz * t
        let near = 0, big = 0
        for (const p of pts) {
          const d = Math.hypot(p[0] - cx, p[1] - cz)
          if (d - p[2] < 25) { near += p[3]; if (p[2] > 6) big++ }
        }
        let np = 0
        for (const q of R.npcs) if (Math.hypot(q.x - cx, q.z - cz) < 25) np++
        let pr = 0
        for (const q of R.props) if (Math.hypot(q.x - cx, q.z - cz) < 25) pr++
        cells.push({ leg: a[0] + '>' + b[0], x: +cx.toFixed(0), z: +cz.toFixed(0),
                     obj: near, big: big, npc: np, prop: pr,
                     y: +I.terrainHeight(cx, cz).toFixed(1), slip: +I.groundSlip(cx, cz).toFixed(2) })
      }
    }
    R.cells = cells
    R.zones = ['city', 'glacier', 'lagoon', 'geothermal', 'spring', 'cliff', 'pier']
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return R
  })
  out.errs = errs.slice(0, 6)
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
