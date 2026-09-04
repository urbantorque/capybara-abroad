async page => {
  // px-ground-b3: qa/b3-ground.js's method (heightfield facet vs the NEAREST
  // drawn surface), restricted to WALKABLE ground (law gradient < 0.75) and
  // reporting the signed disagreement: + means the picture is ABOVE the
  // collider (the animal will look sunk), - means below (it will look afloat).
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  const CH = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice',
    'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const out = { rows: [] }
  for (const nm of CH) {
    let row
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy, CANNON = g.CANNON, THREE = g.THREE
        if (g.biome.current !== nm) g.biome.switchTo(nm)
        for (let i = 0; i < 20; i++) g.tick(1 / 60, false)
        const api = nm === 'sydney' ? g.env : g[nm]
        const r = { biome: nm, live: g.biome.current }
        if (!api || typeof api.terrainHeight !== 'function') { r.noTerrain = true; return r }
        const th = (x, z) => { const v = api.terrainHeight(x, z); return typeof v === 'number' ? v : NaN }
        const ow = typeof api.isOverWater === 'function' ? (x, z) => !!api.isOverWater(x, z) : () => false
        const HS = []
        for (const b of g.world.bodies) {
          if (b.mass !== 0) continue
          for (let si = 0; si < b.shapes.length; si++) {
            const s = b.shapes[si]
            if (!(s instanceof CANNON.Heightfield)) continue
            HS.push({ EL: s.elementSize, D: s.data, NX: s.data.length - 1, NZ: s.data[0].length - 1, X0: b.position.x, Z1: b.position.z, Y: b.position.y })
          }
        }
        if (!HS.length) { r.noHf = true; return r }
        r.tiles = HS.map(H => ({ EL: H.EL, NX: H.NX, NZ: H.NZ, X0: +H.X0.toFixed(2), Z1: +H.Z1.toFixed(2), Y: +H.Y.toFixed(2) }))
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
        let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1u = -Infinity
        for (const H of HS) {
          X0 = Math.min(X0, H.X0); X1 = Math.max(X1, H.X0 + H.NX * H.EL)
          Z1u = Math.max(Z1u, H.Z1); Z0 = Math.min(Z0, H.Z1 - H.NZ * H.EL)
        }
        const ray = new THREE.Raycaster(); ray.far = 300
        const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0)
        g.capy.group.visible = false
        let n = 0, near = 0, sum = 0, abs = 0, o15 = 0, o15up = 0, o50 = 0, noHit = 0, lawOff = 0
        let worst = 0, worstAt = null
        const culprits = {}
        const N = 30
        for (let a = 0; a < N; a++) for (let b2 = 0; b2 < N; b2++) {
          const x = X0 + (X1 - X0) * (a + 0.37) / N, z = Z1u - (Z1u - Z0) * (b2 + 0.61) / N
          if (ow(x, z)) continue
          const f = facetY(x, z); if (!(f === f)) continue
          const gx = (th(x + 0.6, z) - th(x - 0.6, z)) / 1.2, gz = (th(x, z + 0.6) - th(x, z - 0.6)) / 1.2
          if (!(Math.hypot(gx, gz) < 0.75)) continue
          org.set(x, f + 90, z); ray.set(org, down)
          const hits = ray.intersectObject(g.scene, true)
          let best = null, bestObj = null
          for (let k = 0; k < hits.length; k++) {
            let p = hits[k].object, vis = true
            while (p) { if (!p.visible) { vis = false; break } p = p.parent }
            if (!vis) continue
            const dy = hits[k].point.y - f
            if (best === null || Math.abs(dy) < Math.abs(best)) { best = dy; bestObj = hits[k].object }
          }
          n++
          const law = th(x, z)
          if (law === law && Math.abs(law - f) > 0.15) lawOff++
          if (best === null) { noHit++; continue }
          near++; sum += best; abs += Math.abs(best)
          if (Math.abs(best) > 0.15) { o15++; if (best > 0) o15up++ }
          if (Math.abs(best) > 0.5) { o50++; const k2 = (bestObj && bestObj.name) || '(unnamed)'; culprits[k2] = (culprits[k2] || 0) + 1 }
          if (Math.abs(best) > Math.abs(worst)) { worst = best; worstAt = [+x.toFixed(0), +z.toFixed(0)] }
        }
        g.capy.group.visible = true
        r.n = n; r.matched = near; r.noHit = noHit
        r.meanSigned = near ? +(sum / near).toFixed(3) : null
        r.meanAbs = near ? +(abs / near).toFixed(3) : null
        r.pctOver15 = near ? +(100 * o15 / near).toFixed(1) : null
        r.pctOver15DrawnAbove = near ? +(100 * o15up / near).toFixed(1) : null
        r.pctOver50 = near ? +(100 * o50 / near).toFixed(1) : null
        r.pctLawVsHf15 = n ? +(100 * lawOff / n).toFixed(1) : null
        r.worst = +worst.toFixed(2); r.worstAt = worstAt
        r.culprits = Object.entries(culprits).sort((p, q) => q[1] - p[1]).slice(0, 4)
        return r
      }, nm)
    } catch (e) { row = { biome: nm, error: String(e).slice(0, 250) } }
    out.rows.push(row)
  }
  await page.evaluate(o => fetch('/shot?name=px-ground-b3.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))
  }), out)
}
