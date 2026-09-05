// THE X5 WALK CONFIRMATION, FINISHED. Two more faults out of the rig, and a
// re-test of every candidate X5 left in an unresolved state.
//
// FAULT 5 (named in commit bb03e7e, never fixed here): place() put the animal at
// terrainHeight + 0.34. terrainHeight is the SEABED under any pier, deck or
// pontoon, so Kowloon's "confirmation" walked an animal along the harbour bed
// 3.6 m under the pontoon it was supposed to be hitting. Fixed: drop from 3 m
// above the higher of terrain and 0, and TICK UNTIL IT SETTLES onto whatever
// surface is actually there.
//
// FAULT 6 (found reading walk4): it settled the animal for 30 ticks and then
// cast both rays from the ORIGINAL x/z with the SETTLED y. On any slope the
// animal slides during those ticks, so the rays came from a place it was not
// standing - which is how a control could be selected with a physics face at
// 0.8-2.0 m and then re-measure as `phys: null` in the very next call. Both rays
// now originate at the settled position, and the row carries it.
async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  // Every candidate X5 did not resolve. Goreme's two are the ones it CONFIRMED
  // as walk-through and never collided; the question now is whether the balloon
  // basket fix (418238e) already closed them. Kowloon's two are the withdrawal.
  // Venice's and Cali's are untrusted because their controls never stopped.
  const C = {
    goreme: [[-8, 10, 1, 0], [-27, 0, 0, -1]],
    kowloon: [[-5, -65, 1, 0], [5, -65, -1, 0]],
    venice: [[-130, -65, -1, 0], [-77, -55, 0, 1]],
    cali: [[-12, -5, 1, 0]]
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
      th(x, z) { const a = this.api(); const v = (a && a.terrainHeight) ? a.terrainHeight(x, z) : 0; return v === v ? v : 0 },
      // DROP AND SETTLE, never place. Returns what it actually landed on.
      place(x, z) {
        const s = window.__x5
        const t = s.th(x, z), top = Math.max(t, 0)
        b.position.set(x, top + 3.0, z)
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        s.sx = 0; s.sz = 0
        let settled = 0
        for (let i = 0; i < 180; i++) {
          s.T(1)
          if (Math.abs(b.velocity.y) < 0.05) { if (++settled > 12) break } else settled = 0
        }
        return { terr: +t.toFixed(2), y: +b.position.y.toFixed(2),
                 x: +b.position.x.toFixed(2), z: +b.position.z.toFixed(2),
                 // how far the standing surface is above the terrain datum the
                 // old rig would have used: >0.5 means it landed on built ground
                 onBuilt: +(b.position.y - 0.34 - t).toFixed(2),
                 gnd: !!g.capy.grounded, swim: !!g.capy.swimming }
      }
    }
    return true
  }

  const RUN = (list) => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON, b = g.capy.body, s = window.__x5
    const nm = g.biome.current
    const ray = new THREE.Raycaster(); ray.far = 3.0
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    const V = new THREE.Vector3(), D = new THREE.Vector3()
    const F = new CANNON.Vec3(), Tv = new CANNON.Vec3()

    const physD = (x, y, z, ux, uz, R) => {
      F.set(x, y, z); Tv.set(x + ux * R, y, z + uz * R)
      let best = null
      try {
        g.world.raycastAll(F, Tv, {}, (res) => {
          if (!res.hasHit) return
          const bd = res.body
          if (!bd || bd === b || bd.mass > 0 || bd.isTrigger) return
          if (bd.userData && (bd.userData.npc || bd.userData.local)) return
          const st = res.shape && res.shape.type
          if (st === CANNON.Shape.types.HEIGHTFIELD || st === CANNON.Shape.types.PLANE) return
          if (best === null || res.distance < best) best = res.distance
        })
      } catch (e) { return null }
      return best === null ? null : +best.toFixed(2)
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
      const at = s.place(x, z)
      // FAULT 6: cast from where the animal actually is, not from where it was asked to be.
      const pd = physD(at.x, at.y, at.z, ux, uz, 3.0)
      const dd = drawnD(at.x, at.y, at.z, ux, uz)
      const row = { tag, nm, x, z, dir: [ux, uz], at, drawn: dd, phys: pd }
      if (dd === null || dd > 2.6) { row.verdict = 'NOT REPRODUCED'; return row }
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

    let ctrl = null
    for (let a = -110; a <= 110 && !ctrl; a += 8) {
      for (let c = -110; c <= 110 && !ctrl; c += 8) {
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
    const rows = []
    const cr = ctrl ? walk(ctrl[0], ctrl[1], ctrl[2], ctrl[3], 'CONTROL')
                    : { tag: 'CONTROL', nm, none: true }
    rows.push(cr)
    const trusted = !cr.none && cr.verdict === 'stopped'
    for (const [x, z, ux, uz] of list) {
      const r = walk(x, z, ux, uz, 'candidate')
      if (!trusted) r.verdict += ' (UNTRUSTED: control did not stop)'
      rows.push(r)
    }
    return rows
  }

  for (const ch of Object.keys(C)) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(3800)
      const seen = await page.evaluate(() => window.__capy.biome.current)
      await page.evaluate(BOOT)
      const rows = await page.evaluate(RUN, C[ch])
      for (const r of rows) r.asked = ch
      if (seen !== ch) out.errs.push('BIOME MISMATCH asked ' + ch + ' got ' + seen)
      out.rows = out.rows.concat(rows)
    } catch (e) { out.rows.push({ nm: ch, error: String(e).slice(0, 180) }) }
  }

  await page.evaluate(o => fetch('/shot?name=px-x5-walk5.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
