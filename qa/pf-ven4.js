async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const r = {}
    g.biome.switchTo('venice')
    const sp = g.biome.spawnOf('venice'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const V = g.venice
    const L = g.locals.filter(q => q.biome === 'venice')

    // ---- how much of the SQUARE is within 15 m of a local (praise radius) ---
    let inSq = 0, covered = 0, inPz = 0, covPz = 0
    for (let x = -70; x <= 20; x += 1) for (let z = -70; z <= 10; z += 1) {
      if (!V.inZone('square', x, z)) continue
      inSq++
      const c = L.some(q => Math.hypot(q.x - x, q.z - z) < 15)
      if (c) covered++
      if (V.inZone('piazza', x, z)) { inPz++; if (c) covPz++ }
    }
    r.squareCells = inSq; r.squareCovered15 = covered
    r.piazzaCells = inPz; r.piazzaCovered15 = covPz

    // ---- scene furniture, by 20 m cell, along the route --------------------
    const objs = []
    g.scene.traverse(o => {
      if (!o.visible) return
      if (o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine) {
        o.getWorldPosition(g.__tmpV = g.__tmpV || new (o.position.constructor)())
        objs.push([g.__tmpV.x, g.__tmpV.z, o.isInstancedMesh ? (o.count || 1) : 1])
      }
    })
    r.nObjs = objs.length
    const ri = V.rialto(), bk = V.boardKnots()
    const ROUTE = [
      ['spawn', sp.x, sp.z], ['cafe', V.cafe.x, V.cafe.z],
      ['piazza', V.piazza.x, V.piazza.z], ['boards0', bk[0], bk[1]],
      ['campo', V.campo.x, V.campo.z], ['calli', V.calli.x, V.calli.z],
      ['gondola', V.gondola().x, V.gondola().z], ['rialto', ri.x, ri.z],
      ['molo', V.molo.x, V.molo.z], ['campanile', V.campanile.x, V.campanile.z],
    ]
    // walk the route in 20 m steps and count furniture / props / locals per cell
    const props = g.props.filter(p => !p.removed && !p.hidden && (!p.biome || p.biome === 'venice'))
    const cells = []
    for (let i = 0; i + 1 < ROUTE.length; i++) {
      const [n0, x0, z0] = ROUTE[i], [n1, x1, z1] = ROUTE[i + 1]
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 20))
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        const cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t
        let furn = 0
        for (const o of objs) if (Math.abs(o[0] - cx) < 10 && Math.abs(o[1] - cz) < 10) furn += o[2]
        const np = props.filter(p => Math.hypot(p.body.position.x - cx, p.body.position.z - cz) < 10).length
        const nl = L.filter(q => Math.hypot(q.x - cx, q.z - cz) < 10).length
        cells.push({ leg: n0 + '->' + n1, x: +cx.toFixed(0), z: +cz.toFixed(0), furn, np, nl })
      }
    }
    r.cells = cells
    r.route = ROUTE.map(q => [q[0], +q[1].toFixed(0), +q[2].toFixed(0)])
    return r
  })

  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venD.json', { method: 'POST', body: bb })
  }, { out, errs })
}
