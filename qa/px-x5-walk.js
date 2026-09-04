async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  // Candidates are the non-vegetation residue of qa/px-solid-audit.js run A:
  // chest-height ray finds a drawn face, world.raycastClosest finds nothing.
  // dir is the ray direction the audit used; d is how far the drawn face was.
  const C = {
    kowloon: [[-5, -65, 1, 0, 0.77], [5, -65, -1, 0, 0.77]],
    venice: [[-77, -55, 0, 1, 1.45], [-77, -20, 0, 1, 1.72], [-130, -65, -1, 0, 0.17]],
    goreme: [[-8, 10, 1, 0, 1.60], [-3, 15, 1, 0, 1.33], [-37, 20, 1, 0, 2.05], [-27, 0, 0, -1, 1.23]],
    sahara: [[258, 55, 0, 1, 2.07], [-60, 25, -1, 0, 1.87], [8, 20, -1, 0, 1.19]],
    palawan: [[-48, 40, 0, -1, 0.34], [-43, 55, -1, 0, 1.29]],
    cali: [[-12, -5, 1, 0, 1.37], [52, 60, 1, 0, 1.93]],
    rio: [[73, -35, -1, 0, 2.18]],
    pantanal: [[92, -110, 0, 1, 0.43]],
    kyoto: [[-37, 20, 0, -1, 1.25]]
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
        b.position.set(x, s.th(x, z) + 0.45, z)
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        s.sx = 0; s.sz = 0; s.T(26)
      }
    }
    return true
  }

  // inp-driven hand-ticking is what X4 used and it moves the animal at exactly
  // capyWALK, but a walk-into-a-wall test is only worth anything if the same rig
  // demonstrably STOPS at a wall — so every chapter carries a control found by
  // asking the solver itself for a face within reach.
  const RUN = (list) => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON, b = g.capy.body, s = window.__x5
    const nm = g.biome.current
    const res = new CANNON.RaycastResult()
    const ray = new THREE.Raycaster(); ray.far = 3.0
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i

    const physDist = (x, y, z, ux, uz, R) => {
      res.reset()
      g.world.raycastClosest(new CANNON.Vec3(x, y, z), new CANNON.Vec3(x + ux * R, y, z + uz * R), {}, res)
      return res.hasHit ? +res.distance.toFixed(2) : null
    }
    const drawnDist = (x, y, z, ux, uz) => {
      ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(ux, 0, uz).normalize())
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

    const walk = (x, z, ux, uz, d, tag) => {
      s.place(x, z)
      const y = b.position.y
      const pd = physDist(x, y, z, ux, uz, 3.0)
      const dd = drawnDist(x, y, z, ux, uz)
      const x0 = b.position.x, z0 = b.position.z
      s.sx = ux; s.sz = uz
      let maxAlong = 0
      for (let i = 0; i < 150; i++) {
        s.T(1)
        const a = (b.position.x - x0) * ux + (b.position.z - z0) * uz
        if (a > maxAlong) maxAlong = a
      }
      s.sx = 0; s.sz = 0
      const face = dd === null ? d : dd
      return { tag, nm, x, z, dir: [ux, uz], drawn: dd, phys: pd, face: +face.toFixed(2),
               along: +maxAlong.toFixed(2),
               verdict: maxAlong > face + 0.55 ? 'PASSED THROUGH' : 'stopped' }
    }

    const rows = []
    // the control: a place where the solver AND the picture agree there is a wall
    let ctrl = null
    for (const t of list) {
      const [x, z] = t
      const y = s.th(x, z) + 0.45
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const pd = physDist(x, y, z, ux, uz, 2.5)
        const dd = drawnDist(x, y, z, ux, uz)
        if (pd !== null && dd !== null && Math.abs(pd - dd) < 0.6 && pd > 0.6) { ctrl = [x, z, ux, uz, dd]; break }
      }
      if (ctrl) break
    }
    if (ctrl) rows.push(walk(ctrl[0], ctrl[1], ctrl[2], ctrl[3], ctrl[4], 'CONTROL solid'))
    else rows.push({ tag: 'CONTROL solid', nm, none: true })
    for (const [x, z, ux, uz, d] of list) rows.push(walk(x, z, ux, uz, d, 'candidate'))
    return rows
  }

  for (const ch of Object.keys(C)) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(3800)
      await page.evaluate(BOOT)
      const r = await page.evaluate(RUN, C[ch])
      out.rows = out.rows.concat(r)
    } catch (e) { out.rows.push({ nm: ch, error: String(e).slice(0, 180) }) }
  }

  await page.evaluate(o => fetch('/shot?name=px-x5-walk.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
