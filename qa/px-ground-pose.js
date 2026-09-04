async page => {
  // px-ground-pose v2: SNAPSHOT style (no per-frame sampler — a per-frame
  // full-scene raycast with every visited chapter still in the scene made
  // frames take 1-30 s). One page, one reload, biome.switchTo between
  // chapters. Rays are cast against VISIBLE top-level groups only. Each
  // target: stand snapshot, mid-walk snapshot, settled snapshot, and a
  // page.screenshot of the standing pose.
  const OUT = 'C:/Users/roger/OneDrive/Desktop/capy3/qa/'
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  const T = [
    { ch: 'goreme', tag: 'slope', x: -7.8, z: 23.7 },
    { ch: 'kyoto', tag: 'uji-bank', x: -25, z: 116 },
    { ch: 'cali', tag: 'slope', x: -64, z: -21.1 },
    { ch: 'cali', tag: 'deck', x: -22, z: 52 },
    { ch: 'rio', tag: 'slope', x: 5.7, z: 77.3 },
    { ch: 'pasto', tag: 'slope', x: -13.8, z: -10.6 },
    { ch: 'pasto', tag: 'plaza-box', x: 0, z: 44 },
    { ch: 'iceland', tag: 'slope', x: -8.7, z: 79.2 },
    { ch: 'manly', tag: 'auto-slope' },
    { ch: 'pantanal', tag: 'auto-slope' },
    { ch: 'antarctic', tag: 'auto-slope' },
    { ch: 'sydney', tag: 'opera-stair', x: 0, z: -2 },
  ]
  const out = { rows: [] }

  const SETUP = () => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
    const nm = g.biome.current
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : NaN; return typeof v === 'number' ? v : NaN }
    const ow = api && typeof api.isOverWater === 'function' ? (x, z) => !!api.isOverWater(x, z) : () => false
    const HS = []
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue
      for (let si = 0; si < b.shapes.length; si++) {
        const s = b.shapes[si]
        if (!(s instanceof CANNON.Heightfield)) continue
        HS.push({ EL: s.elementSize, D: s.data, NX: s.data.length - 1, NZ: s.data[0].length - 1, X0: b.position.x, Z1: b.position.z, Y: b.position.y })
      }
    }
    function tileY(H, x, z) {
      const fi = (x - H.X0) / H.EL, fj = (H.Z1 - z) / H.EL
      const i = Math.floor(fi), j = Math.floor(fj)
      if (i < 0 || j < 0 || i >= H.NX || j >= H.NZ) return NaN
      const u = fi - i, v = fj - j, D = H.D
      const h00 = D[i][j], h10 = D[i + 1][j], h01 = D[i][j + 1], h11 = D[i + 1][j + 1]
      if (u + v <= 1) return H.Y + h00 + (h10 - h00) * u + (h01 - h00) * v
      return H.Y + h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)
    }
    function facetY(x, z) {
      let best = NaN
      for (const H of HS) { const v = tileY(H, x, z); if (v === v && (!(best === best) || v > best)) best = v }
      return best
    }
    const ray = new THREE.Raycaster(); ray.far = 9
    const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), lp = new THREE.Vector3()
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    function groundUnder(x, y, z) {
      org.set(x, y, z); ray.set(org, down)
      const roots = g.scene.children.filter(c => c.visible && c !== g.capy.group)
      const hits = ray.intersectObjects(roots, true)
      for (let k = 0; k < hits.length; k++) {
        let o = hits[k].object, vis = true, wat = false
        while (o) {
          if (!o.visible) { vis = false; break }
          if (o.name && WATER.test(o.name)) { wat = true; break }
          o = o.parent
        }
        if (!vis || wat) continue
        const m = hits[k].object.material
        if (m && m.transparent && m.opacity < 0.6) continue
        let nm2 = hits[k].object.name, p = hits[k].object
        while (!nm2 && p.parent) { p = p.parent; nm2 = p.name }
        return { y: hits[k].point.y, n: nm2 || '' }
      }
      return null
    }
    const legs = []
    g.capy.group.traverse(n => {
      if (n.isGroup && Math.abs(n.position.y - 0.32) < 0.01 && Math.abs(Math.abs(n.position.x) - 0.15) < 0.01) legs.push(n)
    })
    // the model = the child of the root with the most descendants
    let model = null, best = -1
    for (const c of g.capy.group.children) { let k = 0; c.traverse(() => k++); if (k > best) { best = k; model = c } }
    window.__pxCtx = { g, api, th, ow, facetY, groundUnder, legs, lp, model }
    return { nm, legs: legs.length, kids: g.capy.group.children.map(c => (c.name || c.type) + ':' + c.position.y.toFixed(2)), hs: HS.map(H => ({ EL: H.EL, NX: H.NX, NZ: H.NZ, X0: H.X0, Z1: H.Z1 })) }
  }
  const SNAP = () => {
    const C = window.__pxCtx, g = C.g
    const b = g.capy.body, rp = g.capy.renderPosition
    const px = b.position.x, pz = b.position.z
    g.capy.group.updateMatrixWorld(true)
    const model = C.model
    const feetY = model.getWorldPosition(C.lp).y
    const gc = C.groundUnder(rp.x, feetY + 0.95, rp.z)
    const soles = []
    for (let li = 0; li < C.legs.length; li++) {
      C.lp.set(0, -0.320, 0.03); C.legs[li].localToWorld(C.lp)
      const gs = C.groundUnder(C.lp.x, feetY + 0.95, C.lp.z)
      soles.push(gs ? { d: +(C.lp.y - gs.y).toFixed(3), n: gs.n.slice(0, 20) } : null)
    }
    return {
      x: +px.toFixed(2), z: +pz.toFixed(2), by: +b.position.y.toFixed(3), ry: +rp.y.toFixed(3),
      my: +model.position.y.toFixed(3), pitch: +model.rotation.x.toFixed(3), roll: +model.rotation.z.toFixed(3),
      terr: +C.th(px, pz).toFixed(3), fac: +C.facetY(px, pz).toFixed(3), feet: +feetY.toFixed(3),
      dg: gc ? +gc.y.toFixed(3) : null, gn: gc ? gc.n.slice(0, 26) : null,
      soles, gr: !!g.capy.grounded, sp: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(2),
      rdt: +(g.state.rawDt || 0).toFixed(3), climbing: !!g.capy.climbing, carried: !!g.capy.carriedBy
    }
  }

  let cur = null
  for (const t of T) {
    const row = { ch: t.ch, tag: t.tag }
    try {
      if (cur !== t.ch) {
        await page.evaluate((nm) => { const g = window.__capy; if (g.biome.current !== nm) g.biome.switchTo(nm) }, t.ch)
        await page.waitForTimeout(4500)
        cur = t.ch
      }
      const info = await page.evaluate(SETUP)
      row.live = info.nm; row.hs = info.hs; row.legs = info.legs; row.kids = info.kids
      if (info.nm !== t.ch) { row.bad = true; out.rows.push(row); continue }
      let tx = t.x, tz = t.z
      if (t.tag === 'auto-slope') {
        const s = await page.evaluate(() => {
          const C = window.__pxCtx, g = C.g
          const sp = g.biome.spawnOf ? g.biome.spawnOf(g.biome.current) : { x: g.capy.body.position.x, z: g.capy.body.position.z }
          let best = null, bd = 1e9
          for (let a = -40; a <= 40; a += 2) for (let b2 = -40; b2 <= 40; b2 += 2) {
            const x = sp.x + a, z = sp.z + b2
            if (C.ow(x, z)) continue
            const h = C.th(x, z); if (!(h === h)) continue
            const gx = (C.th(x + 0.6, z) - C.th(x - 0.6, z)) / 1.2, gz = (C.th(x, z + 0.6) - C.th(x, z - 0.6)) / 1.2
            const gr = Math.hypot(gx, gz); if (gr < 0.25 || gr > 0.6) continue
            const d = Math.hypot(a, b2); if (d < 8) continue
            if (d < bd) { bd = d; best = { x, z, gr: +gr.toFixed(2) } }
          }
          return best
        })
        if (!s) { row.noSlope = true; out.rows.push(row); continue }
        tx = s.x; tz = s.z; row.auto = s
      }
      await page.evaluate(({ x, z }) => {
        const C = window.__pxCtx, g = C.g
        g.capy.carriedBy = null
        const h = C.th(x, z), f = C.facetY(x, z)
        g.capy.body.position.set(x, Math.max(h, f === f ? f : h) + 1.0, z)
        g.capy.body.velocity.set(0, 0, 0)
        g.capy.body.previousPosition.copy(g.capy.body.position)
        g.capy.body.interpolatedPosition.copy(g.capy.body.position)
      }, { x: tx, z: tz })
      await page.waitForTimeout(2800)
      row.stand = await page.evaluate(SNAP)
      await page.screenshot({ path: OUT + 'px-ground-' + t.ch + '-' + t.tag + '.png', timeout: 20000 })
      row.stand2 = await page.evaluate(SNAP)
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(900)
      row.walk1 = await page.evaluate(SNAP)
      await page.waitForTimeout(700)
      row.walk2 = await page.evaluate(SNAP)
      await page.keyboard.up('KeyW')
      await page.waitForTimeout(700)
      row.settle = await page.evaluate(SNAP)
      row.target = { x: tx, z: tz }
    } catch (e) { row.error = String(e).slice(0, 300) }
    out.rows.push(row)
  }
  await page.evaluate(o => fetch('/shot?name=px-ground-pose2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
