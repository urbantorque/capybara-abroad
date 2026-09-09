async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  // The two structures the build-loop read found, and one control each that was
  // already solid in the same builder.
  const T = {
    kyoto: [
      { tag: 'shrine', x: -32, z: -110, r: 8 },
      { tag: 'CONTROL torii leg', x: -34, z: -128, r: 8 }
    ],
    venice: [
      { tag: 'Salute', x: -86, z: 46, r: 20 },
      { tag: 'CONTROL campanile', x: null, z: null, r: 12, useCampanile: true }
    ]
  }

  const R = (list) => {
    const g = window.__capy, CANNON = g.CANNON, b = g.capy.body, inp = g.input
    const nm = g.biome.current
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
    const tick = (k, sx, sz) => {
      for (let i = 0; i < k; i++) {
        inp.x = sx || 0; inp.z = sz || 0; inp.run = false; inp.camYaw = 0
        inp.jump = false; inp.jumpPressed = false
        g.tick(1 / 60, false)
      }
    }
    const res = new CANNON.RaycastResult()
    const solidAt = (x, y, z, ux, uz, R2) => {
      // straight question: is there a static, non-ground collider on this line?
      let best = null
      try {
        g.world.raycastAll(new CANNON.Vec3(x, y, z), new CANNON.Vec3(x + ux * R2, y, z + uz * R2), {}, (r) => {
          if (!r.hasHit) return
          const bd = r.body
          if (!bd || bd === b || bd.mass > 0 || bd.isTrigger) return
          const st = r.shape && r.shape.type
          if (st === CANNON.Shape.types.HEIGHTFIELD || st === CANNON.Shape.types.PLANE) return
          if (best === null || r.distance < best) best = r.distance
        })
      } catch (e) { return null }
      return best === null ? null : +best.toFixed(2)
    }
    const rows = []
    for (const t of list) {
      let cx = t.x, cz = t.z
      if (t.useCampanile && api && api.campanile) { cx = api.campanile.x; cz = api.campanile.z }
      if (cx === null) { rows.push({ nm, tag: t.tag, skipped: true }); continue }
      // Chest height over whichever surface the animal would actually be ON.
      // Casting at terrainHeight + 0.34 put the Salute's rays at y -3.46, three
      // and a half metres UNDER a base that spans 0..6, and reported 0/4 for a
      // collider that was present and correct. Over water the animal floats at
      // the waterline, not on the bed.
      const wl = (api && typeof api.waterLevel === 'number') ? api.waterLevel : -1e9
      const ow = !!(api && api.isOverWater && api.isOverWater(cx, cz))
      const surf = ow ? Math.max(th(cx, cz), wl) : th(cx, cz)
      const y = surf + 0.34
      const hits = []
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        hits.push(solidAt(cx - ux * t.r, y, cz - uz * t.r, ux, uz, t.r * 2))
      // ...and walk in from one side, dropped from above so a deck or a water
      // surface is found rather than assumed
      const sx0 = cx - t.r, sz0 = cz
      b.position.set(sx0, th(sx0, sz0) + 3.0, sz0)
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      tick(80)
      const x0 = b.position.x
      let maxAlong = 0
      for (let i = 0; i < 220; i++) {
        tick(1, 1, 0)
        const a = b.position.x - x0
        if (a > maxAlong) maxAlong = a
      }
      tick(10, 0, 0)
      rows.push({
        nm, tag: t.tag, at: [cx, cz],
        raysSolid: hits.filter(h => h !== null).length,
        rays: hits,
        walkedIn: +maxAlong.toFixed(2),
        reachedCentre: maxAlong > t.r - 0.8,
        finalDistToCentre: +Math.hypot(b.position.x - cx, b.position.z - cz).toFixed(2)
      })
    }
    return rows
  }

  for (const ch of Object.keys(T)) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(4000)
      out.rows = out.rows.concat(await page.evaluate(R, T[ch]))
    } catch (e) { out.rows.push({ nm: ch, error: String(e).slice(0, 200) }) }
  }
  await page.evaluate(o => fetch('/shot?name=px-x5-loops.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
