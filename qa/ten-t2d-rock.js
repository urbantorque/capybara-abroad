async page => {
  // THE ROCK IS SOLID (TEN T2d). Arpoador's stones, three ways:
  //   rays  — audit-solid2's test at each stone: eight horizontal rays at
  //           ground + 0.5 m from 4 m outside the waist toward the centre;
  //           the drawn hit (the stones' mesh) against the physics hit (the
  //           rock body). A walk-through is a drawn hit with no physics hit
  //           within 0.45 m of it.
  //   shove — the animal put 1 m outside each big stone and pushed at it at
  //           3 m/s for 1.5 s of game.tick: the least horizontal distance it
  //           reaches, and whether it is ever inside the waist below the cap.
  //   way   — navBlocked along the wedge from the calçadão to the summit.
  // Writes qa/ten-t2d-rock.json.png (text).
  const PORT = 5194
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'rio') { g.state.journeyMode = 'free'; g.hud.cross('rio'); await new Promise(r => setTimeout(r, 9000)) } })
  const out = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON
    const R = g.rio, st = R.rockStones()
    const cx = R.arpoadorRock.x, cz = R.arpoadorRock.z
    let mesh = null
    g.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && Math.abs(o.position.x - cx) < 1e-3 && Math.abs(o.position.z - cz) < 1e-3) mesh = o })
    let rock = null
    for (const b of g.world.bodies) if (b.mass === 0 && b.shapes.length === st.length && b.shapes.every(s => s instanceof C.ConvexPolyhedron)) rock = b
    const out = { stones: st.length, big: st.filter(s => s.big).length, mesh: !!mesh, rockBody: !!rock, bodies: g.world.bodies.length, rays: 0, drawnHits: 0, walkThrough: 0, wt: [], shove: [], way: null, err: null }
    if (!mesh || !rock) return out
    mesh.updateMatrixWorld(true)
    const rc = new T.Raycaster()
    // twice: with the rock body, and with it lifted out of the world (the
    // chapter as it shipped before T2d — drawn stones, no collider)
    for (const pass of ['after', 'before']) {
    if (pass === 'before') { out.after = { rays: out.rays, drawnHits: out.drawnHits, walkThrough: out.walkThrough }; out.rays = 0; out.drawnHits = 0; out.walkThrough = 0; g.world.removeBody(rock) }
    for (let i = 0; i < st.length; i++) {
      const s = st[i], gy = R.terrainHeight(s.x, s.z)
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, far = Math.max(s.s, s.sz) + 4
        const y = gy + 0.5
        const ox = s.x + Math.cos(a) * far, oz = s.z + Math.sin(a) * far
        const dir = new T.Vector3(-Math.cos(a), 0, -Math.sin(a))
        rc.set(new T.Vector3(ox, y, oz), dir); rc.far = far
        const hits = rc.intersectObject(mesh, false)
        out.rays++
        if (!hits.length) continue
        out.drawnHits++
        const dDraw = hits[0].distance
        // two physics rays 5 cm either side of the drawn one: a ray laid
        // exactly along a polyhedron's edge misses it in cannon (measured,
        // qa/ten-t2d-rayprobe.js), and a 0.34 m animal cannot pass a seam
        let dPhys = Infinity
        for (const off of [-0.05, 0.05]) {
          const lx = -dir.z * off, lz = dir.x * off
          const ray = new C.Ray(new C.Vec3(ox + lx, y, oz + lz), new C.Vec3(ox + lx + dir.x * far, y, oz + lz + dir.z * far))
          ray.intersectWorld(g.world, { mode: C.Ray.ALL, skipBackfaces: false, callback: r => { if (r.body === rock && r.distance < dPhys) dPhys = r.distance } })
        }
        if (!(dPhys <= dDraw + 0.45)) { out.walkThrough++; if (pass === 'after' && out.wt.length < 12) out.wt.push({ i, k, big: s.big, dDraw: +dDraw.toFixed(2), dPhys: dPhys === Infinity ? null : +dPhys.toFixed(2) }) }
      }
    }
    }
    out.before = { rays: out.rays, drawnHits: out.drawnHits, walkThrough: out.walkThrough }
    g.world.addBody(rock)
    // the way up: navBlocked along the wedge, r 14 → 0
    let blk = 0, n = 0
    for (let r = 14; r >= 0; r -= 0.5) {
      for (const da of [-0.2, 0, 0.2]) {
        const a = 0.96 + da, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
        n++; if (R.navBlocked(x, z, 0.34)) { blk++; if (!out.wayAt) out.wayAt = []; out.wayAt.push([+x.toFixed(1), +z.toFixed(1), +r.toFixed(1)]) }
      }
    }
    out.way = { samples: n, blocked: blk }
    out.posto6 = { mid: R.posto6, inZone: R.inZone('posto6', R.posto6.x, R.posto6.z), onRock: R.inZone('arpoador', R.posto6.x, R.posto6.z),
                   rockToZone: +(Math.hypot(-50 - cx, -12 - cz) - R.arpoadorRock.r).toFixed(1) }
    out.err = g.state.lastError ? String(g.state.lastError).slice(0, 160) : null
    return out
  })
  // shove, one stone per evaluate (game.tick is slow at a high rung)
  const bigIdx = await page.evaluate(() => window.__capy.rio.rockStones().map((s, i) => s.big ? i : -1).filter(i => i >= 0))
  for (const i of bigIdx) {
    const row = await page.evaluate((i) => {
      const g = window.__capy, R = g.rio, s = R.rockStones()[i], b = g.capy.body
      const cx = R.arpoadorRock.x, cz = R.arpoadorRock.z
      // come at it from the rock's centre side, where the ground is higher
      const a = Math.atan2(cz - s.z, cx - s.x)
      const d0 = Math.max(s.s, s.sz) + 0.34 + 1.0
      const x0 = s.x + Math.cos(a) * d0, z0 = s.z + Math.sin(a) * d0
      b.position.set(x0, R.terrainHeight(x0, z0) + 0.6, z0); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      let dmin = 1e9, inside = 0
      for (let t = 0; t < 90; t++) {
        const dx = s.x - b.position.x, dz = s.z - b.position.z, L = Math.hypot(dx, dz) || 1
        b.velocity.x = dx / L * 3; b.velocity.z = dz / L * 3
        g.tick(1 / 60, false)
        const ex = (b.position.x - s.x) / s.s, ez = (b.position.z - s.z) / s.sz
        const e = Math.hypot(ex, ez)
        if (e < dmin) dmin = e
        if (e < 0.7 && b.position.y < s.y + s.sy * 0.5) inside++
      }
      return { i, s: +s.s.toFixed(2), dminWaist: +dmin.toFixed(2), insideTicks: inside, endY: +(b.position.y - s.y).toFixed(2) }
    }, i)
    out.shove.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=ten-t2d-rock.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
  // and a look at it from the sand
  await page.evaluate(() => {
    const g = window.__capy, R = g.rio, b = g.capy.body
    const x = -46, z = -10
    b.position.set(x, R.terrainHeight(x, z) + 0.6, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'qa/ten-t2d-rock.png' })
}
