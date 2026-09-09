async page => {
  // px-ground-walk: the animal walked over three legs per chapter under REAL
  // keys and the real clock, sampling every 50 ms: body y, the terrain law,
  // the DRAWN ground under the model (ray from just above the crown, own
  // meshes hidden, water skipped, ancestor visibility walked) and the model's
  // drawn feet. Positive sink = drawn ground ABOVE the drawn feet.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  const KEYS = [['Digit1', 'sydney'], ['Digit2', 'pasto'], ['Digit3', 'quay'], ['Digit4', 'kyoto'],
    ['Digit5', 'cali'], ['Digit6', 'rio'], ['Digit7', 'iceland'], ['Digit8', 'sahara'],
    ['Digit9', 'drift'], ['Digit0', 'venice'], ['Minus', 'kowloon'], ['Equal', 'palawan'],
    ['BracketLeft', 'goreme'], ['BracketRight', 'manly'], ['Semicolon', 'pantanal'],
    ['Quote', 'cave'], ['Comma', 'antarctic'], ['Period', 'monaco'], ['Slash', 'hanoi']]
  const out = { rows: [] }
  const SAMPLER = () => {
    const g = window.__capy, THREE = g.THREE
    const nm = g.biome.current
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : NaN; return typeof v === 'number' ? v : NaN }
    const ow = api && typeof api.isOverWater === 'function' ? (x, z) => !!api.isOverWater(x, z) : () => false
    const ray = new THREE.Raycaster(); ray.far = 8
    const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), lp = new THREE.Vector3()
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    const legs = []
    g.capy.group.traverse(n => {
      if (n.isGroup && Math.abs(n.position.y - 0.32) < 0.01 && Math.abs(Math.abs(n.position.x) - 0.15) < 0.01) legs.push(n)
    })
    function groundUnder(x, y, z) {
      org.set(x, y, z); ray.set(org, down)
      const hits = ray.intersectObject(g.scene, true)
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
        return { y: hits[k].point.y, n: hits[k].object.name || hits[k].object.parent && hits[k].object.parent.name || '' }
      }
      return null
    }
    window.__px = { s: [], nm: nm }
    window.__pxT = setInterval(() => {
      try {
        const b = g.capy.body, rp = g.capy.renderPosition
        const px = b.position.x, pz = b.position.z
        if (ow(px, pz)) return
        g.capy.group.updateMatrixWorld(true)
        const model = g.capy.group.children[0]
        const feetY = model.getWorldPosition(lp).y
        g.capy.group.visible = false
        const gc = groundUnder(rp.x, feetY + 0.95, rp.z)
        const soles = []
        for (let li = 0; li < legs.length; li++) {
          lp.set(0, -0.320, 0.03); legs[li].localToWorld(lp)
          const gs = groundUnder(lp.x, feetY + 0.95, lp.z)
          soles.push(gs ? +(lp.y - gs.y).toFixed(3) : null)
        }
        g.capy.group.visible = true
        window.__px.s.push({
          x: +px.toFixed(2), z: +pz.toFixed(2), by: +b.position.y.toFixed(3), ry: +rp.y.toFixed(3),
          terr: +th(px, pz).toFixed(3), feet: +feetY.toFixed(3),
          dg: gc ? +gc.y.toFixed(3) : null, gn: gc ? gc.n.slice(0, 24) : null,
          soles: soles, gr: !!g.capy.grounded, sp: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(2),
          yaw: +(g.capy.group.rotation.y).toFixed(2)
        })
      } catch (e) { window.__px.err = String(e).slice(0, 120) }
    }, 50)
  }
  const STOP = () => { clearInterval(window.__pxT); const r = window.__px; window.__px = null; return r }

  for (const [key, nm] of KEYS) {
    const row = { biome: nm, legs: [] }
    try {
      await page.goto('http://localhost:5188/')
      await page.waitForTimeout(5200)
      await page.keyboard.press(key)
      await page.waitForTimeout(9000)
      const info = await page.evaluate((nm) => {
        const g = window.__capy, CANNON = g.CANNON
        const live = g.biome.current
        if (live !== nm) return { live: live, bad: true }
        const api = nm === 'sydney' ? g.env : g[nm]
        const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : NaN; return typeof v === 'number' ? v : NaN }
        const ow = api && typeof api.isOverWater === 'function' ? (x, z) => !!api.isOverWater(x, z) : () => false
        const sp = g.biome.spawnOf ? g.biome.spawnOf(nm) : { x: g.capy.body.position.x, z: g.capy.body.position.z }
        const bb = g.biome.boundsOf ? g.biome.boundsOf(nm) : null
        const rects = bb ? (bb.rects || [bb]) : [{ x0: sp.x - 120, x1: sp.x + 120, z0: sp.z - 120, z1: sp.z + 120 }]
        // a walkable slope, nearest to the spawn
        let slope = null, sd = 1e9
        for (const q of rects) {
          const N = 30
          for (let a = 0; a < N; a++) for (let b2 = 0; b2 < N; b2++) {
            const x = q.x0 + (q.x1 - q.x0) * (a + 0.43) / N, z = q.z0 + (q.z1 - q.z0) * (b2 + 0.57) / N
            if (ow(x, z)) continue
            const h = th(x, z); if (!(h === h)) continue
            const gx = (th(x + 0.6, z) - th(x - 0.6, z)) / 1.2, gz = (th(x, z + 0.6) - th(x, z - 0.6)) / 1.2
            const gr = Math.hypot(gx, gz); if (!(gr > 0.22) || gr > 0.65) continue
            const d = Math.hypot(x - sp.x, z - sp.z); if (d < 12) continue
            if (d < sd) { sd = d; slope = { x: +x.toFixed(1), z: +z.toFixed(1), gr: +gr.toFixed(2), h: +h.toFixed(2) } }
          }
        }
        // a built surface: a static box top 0.15..4 m over the law, at least 3x3
        let deck = null, dbest = -1
        for (const b of g.world.bodies) {
          if (b.mass !== 0) continue
          for (let si = 0; si < b.shapes.length; si++) {
            const s = b.shapes[si]
            if (!(s instanceof CANNON.Box)) continue
            const he = s.halfExtents
            const wp = b.position.vadd(b.quaternion.vmult(b.shapeOffsets[si]))
            const ex = Math.min(he.x, he.z) * 2
            if (ex < 3 || he.y > 3) continue
            const top = wp.y + he.y
            const h = th(wp.x, wp.z)
            if (!(h === h)) continue
            const over = top - h
            if (over < 0.15 || over > 4) continue
            if (ow(wp.x, wp.z)) continue
            const d = Math.hypot(wp.x - sp.x, wp.z - sp.z)
            if (d > 180) continue
            const score = ex * 4 - d
            if (score > dbest) { dbest = score; deck = { x: +wp.x.toFixed(1), z: +wp.z.toFixed(1), top: +top.toFixed(2), over: +over.toFixed(2), hx: +he.x.toFixed(1), hz: +he.z.toFixed(1), d: +d.toFixed(0) } }
          }
        }
        return { live: live, spawn: { x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) }, slope: slope, deck: deck }
      }, nm)
      row.info = info
      if (info.bad) { out.rows.push(row); continue }
      const targets = [{ tag: 'spawn', x: info.spawn.x, z: info.spawn.z }]
      if (info.slope) targets.push({ tag: 'slope', x: info.slope.x, z: info.slope.z })
      if (info.deck) targets.push({ tag: 'deck', x: info.deck.x, z: info.deck.z })
      for (const T of targets) {
        // drop near the target, let the rig settle, THEN read the yaw and put
        // the animal 3.4 m back along it, THEN hold W within a quarter second
        await page.evaluate((T) => {
          const g = window.__capy
          const nm = g.biome.current, api = nm === 'sydney' ? g.env : g[nm]
          const h = api.terrainHeight(T.x, T.z + 3)
          g.capy.carriedBy = null
          g.capy.body.position.set(T.x, (T.y != null ? T.y : h) + 0.9, T.z + 3)
          g.capy.body.velocity.set(0, 0, 0)
          g.capy.body.previousPosition.copy(g.capy.body.position)
          g.capy.body.interpolatedPosition.copy(g.capy.body.position)
        }, T)
        await page.waitForTimeout(2600)
        const st = await page.evaluate((T) => {
          const g = window.__capy
          const nm = g.biome.current, api = nm === 'sydney' ? g.env : g[nm]
          const yaw = g.input.camYaw || 0
          const x = T.x + Math.sin(yaw) * 3.4, z = T.z + Math.cos(yaw) * 3.4
          const h = api.terrainHeight(x, z)
          g.capy.body.position.set(x, Math.max(h, g.capy.body.position.y - 0.9) + 0.7, z)
          g.capy.body.velocity.set(0, 0, 0)
          g.capy.body.previousPosition.copy(g.capy.body.position)
          g.capy.body.interpolatedPosition.copy(g.capy.body.position)
          return { yaw: +yaw.toFixed(2), x: +x.toFixed(1), z: +z.toFixed(1) }
        }, T)
        await page.waitForTimeout(220)
        await page.evaluate(SAMPLER)
        await page.keyboard.down('KeyW')
        await page.waitForTimeout(3600)
        await page.keyboard.up('KeyW')
        await page.waitForTimeout(500)
        const S = await page.evaluate(STOP)
        row.legs.push({ tag: T.tag, start: st, n: S ? S.s.length : 0, err: S ? S.err : 'no sampler', live: S ? S.nm : null, s: S ? S.s : [] })
      }
      row.lastError = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError).slice(0, 160) : null)
    } catch (e) {
      row.error = String(e).slice(0, 300)
    }
    out.rows.push(row)
  }
  await page.evaluate(o => fetch('/shot?name=px-ground-walk.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
