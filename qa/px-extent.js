async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 900, height: 560 })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const PTS = {
    kyoto: [[0, 220, 'north strip'], [100, 225, 'north strip'], [-120, 215, 'north strip'],
            [0, 0, 'CONTROL centre'], [0, 205, 'CONTROL inside old HF']],
    cali: [[5, 162, '+z strip'], [-100, 160, '+z strip'], [0, 100, 'CONTROL centre']],
    goreme: [[-150, 0, '-x strip'], [-150, -80, '-x strip'], [0, -195, '-z strip'],
             [0, 0, 'CONTROL centre']],
    kowloon: [[4, 110, '+z strip'], [-40, 115, '+z strip'], [0, 0, 'CONTROL centre']],
    antarctic: [[212.5, 0, '+x 1m sliver'], [0, 0, 'CONTROL centre']]
  }

  const PROBE = (pts) => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
    const nm = g.biome.current
    const api = nm === 'sydney' ? g.env : g[nm]
    const hs = []
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue
      for (const s of b.shapes) {
        if (!(s instanceof CANNON.Heightfield)) continue
        hs.push({ EL: s.elementSize, NX: s.data.length - 1, NZ: s.data[0].length - 1,
                  X0: b.position.x, Z1: b.position.z })
      }
    }
    const inHF = (x, z) => hs.some(H =>
      x >= H.X0 && x <= H.X0 + H.NX * H.EL && z <= H.Z1 && z >= H.Z1 - H.NZ * H.EL)
    const ray = new THREE.Raycaster(); ray.far = 400
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    // EVERY hit down the column, not just the topmost. The first thing a ray
    // from 220 m meets is whatever scenery stands on the ground - a fairy
    // chimney at Goreme's centre is 16.7 m over the law - so a probe that
    // takes hit[0] and asks "is this the ground?" answers no in the middle of
    // a chapter that is plainly drawn. Ask instead whether ANY hit in the
    // column is near the law; that one is the ground, whatever is stacked
    // above it.
    const drawnAt = (x, z) => {
      ray.set(new THREE.Vector3(x, 220, z), new THREE.Vector3(0, -1, 0))
      const roots = g.scene.children.filter(c => c.visible && c !== g.capy.group)
      const ys = []
      for (const h of ray.intersectObjects(roots, true)) {
        let o = h.object, ok = true
        while (o) { if (!o.visible || (o.name && WATER.test(o.name))) { ok = false; break } o = o.parent }
        if (ok) ys.push(+h.point.y.toFixed(2))
      }
      return ys
    }
    const res = new CANNON.RaycastResult()
    const physAt = (x, z) => {
      res.reset()
      g.world.raycastClosest(new CANNON.Vec3(x, 220, z), new CANNON.Vec3(x, -60, z), {}, res)
      return res.hasHit ? +res.hitPointWorld.y.toFixed(2) : null
    }
    const rows = []
    for (const [x, z, tag] of pts) {
      const ys = drawnAt(x, z), p = physAt(x, z)
      const th = api && api.terrainHeight ? +api.terrainHeight(x, z).toFixed(2) : null
      // ...and a hit only counts as GROUND if it is near the law. Cali and
      // Kowloon both hang a deep skirt off the edge of the world, so out in
      // their strips the column does contain a hit - at y -141 and -177
      // against a law of 0 - and counting it read as "the picture is there",
      // hiding the very strips this probe exists to find.
      const near = th === null ? ys.slice(0, 1)
                               : ys.filter(y => Math.abs(y - th) <= 3)
      const seen = near.length > 0
      rows.push({ x, z, tag, hits: ys.length, ground: seen ? near[0] : null,
                  top: ys.length ? ys[0] : null, phys: p, hf: inHF(x, z), law: th,
                  verdict: (seen && !inHF(x, z)) ? 'DRAWN-NO-COLLIDER'
                         : (!seen && inHF(x, z)) ? 'COLLIDER-NO-PICTURE' : 'ok' })
    }
    return { nm, hs: hs.map(H => ({ EL: H.EL, x: [H.X0, H.X0 + H.NX * H.EL], z: [H.Z1 - H.NZ * H.EL, H.Z1] })), rows }
  }

  const out = { at: new Date().toISOString(), chapters: [] }
  for (const ch of Object.keys(PTS)) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (g.biome.current !== nm) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(4500)
      const r = await page.evaluate(PROBE, PTS[ch])
      r.asked = ch
      out.chapters.push(r)
    } catch (e) { out.chapters.push({ asked: ch, error: String(e).slice(0, 200) }) }
  }
  await page.evaluate(o => fetch('/shot?name=px-extent.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
