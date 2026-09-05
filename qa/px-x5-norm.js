// IS THE DRAWN FACE A WALL, OR IS IT THE GROUND RISING?
//
// Fault 4 taught the PHYSICS ray to skip HEIGHTFIELD and PLANE, because a
// horizontal ray at chest height on a slope hits the terrain and you do not stop
// at a slope, you walk up it. Nothing ever taught the DRAWN ray the same thing,
// and the drawn ray is the half that nominates candidates. A merged relief mesh
// or a road ribbon is drawn geometry like any other, so every hillside in the
// game reads to it as a wall at chest height.
//
// Two tests, either of which settles it:
//   NORMAL   - the world normal of the hit face. |ny| > 0.5 is a surface you
//              stand on; a wall's normal is near-horizontal.
//   TWO HEIGHTS - cast at ankle and at head. A wall stops both at the same
//              distance. A rising slope lets the higher ray run further.
// Repeated three times per point, because a "face" that moves between runs is a
// cat or a person and belongs to X6, not to the walls.
async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const C = {
    goreme: [[-8, 10, 1, 0], [-27, 0, 0, -1], [-70, -46, -1, 0]],
    cali: [[-12, -5, 1, 0], [-78, -46, 0, 1]],
    kowloon: [[-30, -46, 1, 0]]
  }

  const RUN = (list) => {
    const g = window.__capy, THREE = g.THREE, b = g.capy.body
    const nm = g.biome.current, inp = g.input
    const T = k => { for (let i = 0; i < k; i++) { inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0; inp.jump = false; inp.jumpPressed = false; g.tick(1 / 60, false) } }
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    const N = new THREE.Matrix3(), NV = new THREE.Vector3()

    const shoot = (P, dy, ux, uz) => {
      const ray = new THREE.Raycaster(); ray.far = 4.0
      ray.set(new THREE.Vector3(P.x, P.y + dy, P.z), new THREE.Vector3(ux, 0, uz).normalize())
      const roots = g.scene.children.filter(c => c.visible && c !== g.capy.group)
      for (const h of ray.intersectObjects(roots, true)) {
        let o = h.object, ok = true
        while (o) { if (!o.visible || (o.name && WATER.test(o.name))) { ok = false; break } o = o.parent }
        if (!ok) continue
        const m = h.object.material
        if (m && m.transparent && m.opacity < 0.6) continue
        let ny = null
        if (h.face) {
          N.getNormalMatrix(h.object.matrixWorld)
          NV.copy(h.face.normal).applyMatrix3(N).normalize()
          ny = +NV.y.toFixed(2)
        }
        return { d: +h.distance.toFixed(2), ny }
      }
      return null
    }

    const rows = []
    for (const [x, z, ux, uz] of list) {
      const t = th(x, z)
      b.position.set(x, Math.max(t, 0) + 3.0, z)
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      let st = 0
      for (let i = 0; i < 180; i++) { T(1); if (Math.abs(b.velocity.y) < 0.05) { if (++st > 12) break } else st = 0 }
      const P = { x: b.position.x, y: b.position.y, z: b.position.z }
      const reps = []
      for (let r = 0; r < 3; r++) {
        reps.push({ ankle: shoot(P, -0.20, ux, uz), chest: shoot(P, 0, ux, uz), head: shoot(P, 1.00, ux, uz) })
        T(30)
        b.position.set(P.x, P.y, P.z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      }
      rows.push({ nm, at: [x, z], dir: [ux, uz], settled: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2)], reps })
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

  await page.evaluate(o => fetch('/shot?name=px-x5-norm.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
