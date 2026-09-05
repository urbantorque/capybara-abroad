// WHAT IS THE FACE? The X5 confirmation says the animal walks through a drawn
// wall at four places and never says what the wall IS, which is why commit
// bb03e7e had to record "belongs to some other builder, still unidentified".
// This settles the animal the walk5 way, casts the drawn ray, and reports the
// hit object's full ancestor chain and world bounding box - enough to name the
// builder from the source without guessing.
async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const C = {
    goreme: [[-8, 10, 1, 0], [-27, 0, 0, -1]],
    cali: [[-12, -5, 1, 0]]
  }

  const RUN = (list) => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON, b = g.capy.body
    const nm = g.biome.current, inp = g.input
    const T = k => { for (let i = 0; i < k; i++) { inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0; inp.jump = false; inp.jumpPressed = false; g.tick(1 / 60, false) } }
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    const rows = []
    for (const [x, z, ux, uz] of list) {
      const t = th(x, z)
      b.position.set(x, Math.max(t, 0) + 3.0, z)
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      let st = 0
      for (let i = 0; i < 180; i++) { T(1); if (Math.abs(b.velocity.y) < 0.05) { if (++st > 12) break } else st = 0 }
      const P = b.position
      const ray = new THREE.Raycaster(); ray.far = 4.0
      ray.set(new THREE.Vector3(P.x, P.y, P.z), new THREE.Vector3(ux, 0, uz).normalize())
      const roots = g.scene.children.filter(c => c.visible && c !== g.capy.group)
      const hits = []
      for (const h of ray.intersectObjects(roots, true)) {
        let o = h.object, ok = true, chain = []
        while (o) { if (!o.visible || (o.name && WATER.test(o.name))) { ok = false; break } chain.push(o.name || o.type); o = o.parent }
        if (!ok) continue
        const m = h.object.material
        if (m && m.transparent && m.opacity < 0.6) continue
        const bb = new THREE.Box3().setFromObject(h.object)
        hits.push({
          d: +h.distance.toFixed(2), chain: chain.slice(0, 6).join(' < '),
          geo: h.object.geometry ? h.object.geometry.type : '?',
          col: (m && m.color) ? '#' + m.color.getHexString() : '?',
          min: [+bb.min.x.toFixed(1), +bb.min.y.toFixed(1), +bb.min.z.toFixed(1)],
          max: [+bb.max.x.toFixed(1), +bb.max.y.toFixed(1), +bb.max.z.toFixed(1)]
        })
        if (hits.length >= 3) break
      }
      // and what the SOLVER has anywhere near that face, for the same reason
      const F = new CANNON.Vec3(P.x, P.y, P.z), Tv = new CANNON.Vec3(P.x + ux * 4, P.y, P.z + uz * 4)
      const solid = []
      try {
        g.world.raycastAll(F, Tv, {}, (res) => {
          if (!res.hasHit || !res.body || res.body === b) return
          solid.push({ d: +res.distance.toFixed(2), type: res.body.type, mass: res.body.mass,
                       shape: res.shape ? res.shape.type : '?' })
        })
      } catch (e) {}
      rows.push({ nm, at: [x, z], dir: [ux, uz], settled: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2)],
                  terr: +t.toFixed(2), drawn: hits, solid })
    }
    return rows
  }

  for (const ch of Object.keys(C)) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(3800)
      const seen = await page.evaluate(() => window.__capy.biome.current)
      if (seen !== ch) { out.errs.push('BIOME MISMATCH asked ' + ch + ' got ' + seen); continue }
      out.rows = out.rows.concat(await page.evaluate(RUN, C[ch]))
    } catch (e) { out.rows.push({ nm: ch, error: String(e).slice(0, 180) }) }
  }

  await page.evaluate(o => fetch('/shot?name=px-x5-id.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))
  }), out)
}
