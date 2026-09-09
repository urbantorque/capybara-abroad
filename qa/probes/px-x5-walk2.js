async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const C = {
    kowloon: [[-5, -65, 1, 0], [5, -65, -1, 0]],
    venice: [[-77, -55, 0, 1], [-77, -20, 0, 1], [-130, -65, -1, 0]],
    goreme: [[-8, 10, 1, 0], [-3, 15, 1, 0], [-27, 0, 0, -1]],
    cali: [[-12, -5, 1, 0], [52, 60, 1, 0]]
  }

  const BOOT = () => {
    const g = window.__capy, b = g.capy.body, inp = g.input
    window.__x5 = {
      sx: 0, sz: 0,
      T(k) {
        const s = window.__x5
        for (let i = 0; i < k; i++) {
          inp.x = s.sx; inp.z = s.sz; inp.run = false; inp.camYaw = 0
          inp.jump = false; inp.jumpPressed = false
          g.tick(1 / 60, false)
        }
      },
      api() { const n = g.biome.current; return n === 'sydney' ? g.env : g[n] },
      th(x, z) { const a = this.api(); return (a && a.terrainHeight) ? a.terrainHeight(x, z) : 0 },
      place(x, z) {
        const s = window.__x5
        b.position.set(x, s.th(x, z) + 0.34, z)
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        s.sx = 0; s.sz = 0; s.T(30)
      }
    }
    return true
  }

  const RUN = (list) => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON, b = g.capy.body, s = window.__x5
    const nm = g.biome.current
    const res = new CANNON.RaycastResult()
    const ray = new THREE.Raycaster(); ray.far = 3.0
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    const V = new THREE.Vector3(), D = new THREE.Vector3()

    const physD = (x, y, z, ux, uz, R) => {
      res.reset()
      g.world.raycastClosest(new CANNON.Vec3(x, y, z), new CANNON.Vec3(x + ux * R, y, z + uz * R), {}, res)
      return res.hasHit ? +res.distance.toFixed(2) : null
    }
    const drawnD = (x, y, z, ux, uz) => {
      V.set(x, y, z); D.set(ux, 0, uz).normalize(); ray.set(V, D)
      const roots = g.scene.children.filter(c => c.visible && c !== g.capy.group)
      for (const h of ray.intersectObjects(roots, true)) {
        let o = h.object, ok = true
        while (o) { if (!o.visible || (o.name && WATER.test(o.name))) { ok = false; break } o = o.parent }
        if (!ok) continue
        const m = h.object.material
        if (m && m.transparent && m.opacity < 0.6) continue
        return +h.distance.toFixed(2)
      }
      return null
    }

    const walk = (x, z, ux, uz, tag) => {
      s.place(x, z)
      const y = b.position.y                       // chest height, as the animal stands
      const pd = physD(x, y, z, ux, uz, 3.0)
      const dd = drawnD(x, y, z, ux, uz)
      const row = { tag, nm, x, z, dir: [ux, uz], drawn: dd, phys: pd }
      // A CANDIDATE THAT DOES NOT REPRODUCE IS NOT A CANDIDATE. If no drawn face
      // is in front of the animal where it actually stands, there is nothing to
      // walk into and the audit's hit was at some other height or origin.
      if (dd === null || dd > 2.6) { row.verdict = 'NOT REPRODUCED (no drawn face ahead)'; return row }
      // ...and an origin already inside a collider is the audit's own filter 2:
      // cannon returns no hit for a ray that starts inside a box, so "no physics
      // hit" there means the most solid place in the world.
      if (pd !== null && pd < 0.35) { row.verdict = 'ORIGIN INSIDE A COLLIDER (skip)'; return row }
      const x0 = b.position.x, z0 = b.position.z
      s.sx = ux; s.sz = uz
      let maxAlong = 0
      for (let i = 0; i < 150; i++) {
        s.T(1)
        const a = (b.position.x - x0) * ux + (b.position.z - z0) * uz
        if (a > maxAlong) maxAlong = a
      }
      s.sx = 0; s.sz = 0
      row.along = +maxAlong.toFixed(2)
      row.verdict = maxAlong > dd + 0.55 ? 'PASSED THROUGH' : 'stopped'
      return row
    }

    const rows = []
    // A CONTROL FOUND ANYWHERE IN THE CHAPTER, not at a candidate point - the
    // candidates are by definition where the solver finds nothing, which is the
    // worst possible place to look for a known wall.
    let ctrl = null
    for (let a = -120; a <= 120 && !ctrl; a += 6) {
      for (let c = -120; c <= 120 && !ctrl; c += 6) {
        const y = s.th(a, c) + 0.34
        if (!(y === y)) continue
        for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const pd = physD(a, y, c, ux, uz, 2.5)
          if (pd === null || pd < 0.8 || pd > 2.0) continue
          const dd = drawnD(a, y, c, ux, uz)
          if (dd === null || Math.abs(pd - dd) > 0.4) continue
          ctrl = [a, c, ux, uz]; break
        }
      }
    }
    rows.push(ctrl ? walk(ctrl[0], ctrl[1], ctrl[2], ctrl[3], 'CONTROL')
                   : { tag: 'CONTROL', nm, none: true })
    for (const [x, z, ux, uz] of list) rows.push(walk(x, z, ux, uz, 'candidate'))
    return rows
  }

  for (const ch of Object.keys(C)) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(3800)
      await page.evaluate(BOOT)
      out.rows = out.rows.concat(await page.evaluate(RUN, C[ch]))
    } catch (e) { out.rows.push({ nm: ch, error: String(e).slice(0, 180) }) }
  }

  await page.evaluate(o => fetch('/shot?name=px-x5-walk2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
