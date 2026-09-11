async page => {
  // m14-crowd.js — 128 people, and are they still all one height?
  //
  // Off the MATRICES, not off the table that says how tall they should be: the
  // build is derived from the instance index and a table saying so is the
  // input, not the result. Decompose every instance of the head mesh and report
  // the spread of its y.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  for (const b of ['venice', 'kowloon']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(9000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2400)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(9000)
    await page.screenshot({ path: 'qa/m14-' + b + '.png' })
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy
      // TRAP 11: do not identify a mesh by its count alone. The crowd cast is
      // SIX meshes that all share one count (48 in Venice, 80 in Mong Kok), so
      // the honest identification is "every mesh at that exact count", and the
      // one wanted is whichever of them sits highest — the head.
      const want = g.biome.current === 'venice' ? 48 : 80
      const cands = []
      g.scene.traverse(function (o) { if (o.isInstancedMesh && o.count === want) cands.push(o) })
      if (!cands.length) return { cur: g.biome.current, found: false }
      const m0 = new g.THREE.Matrix4(), p0 = new g.THREE.Vector3()
      const s0 = new g.THREE.Vector3(), q0 = new g.THREE.Quaternion()
      let best = null, bestY = -1e9
      for (const c of cands) {
        c.getMatrixAt(0, m0); m0.decompose(p0, q0, s0)
        if (s0.x > 0.01 && p0.y > bestY) { bestY = p0.y; best = c }
      }
      if (!best) return { cur: g.biome.current, found: false, cands: cands.length }
      const m = new g.THREE.Matrix4(), p = new g.THREE.Vector3()
      const s = new g.THREE.Vector3(), q = new g.THREE.Quaternion()
      const ys = [], ss = []
      for (let i = 0; i < best.count; i++) {
        best.getMatrixAt(i, m); m.decompose(p, q, s)
        if (s.x < 0.01) continue
        ys.push(p.y); ss.push(s.y)
      }
      const rng = (a) => a.length ? +(Math.max.apply(null, a) - Math.min.apply(null, a)).toFixed(4) : -1
      const uniq = new Set(ss.map(v => v.toFixed(4)))
      return { cur: g.biome.current, found: true, meshes: cands.length, n: ys.length,
               scaleSpread: rng(ss), distinctScales: uniq.size,
               ySpread: rng(ys),
               minS: ss.length ? +Math.min.apply(null, ss).toFixed(3) : -1,
               maxS: ss.length ? +Math.max.apply(null, ss).toFixed(3) : -1 }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m14-crowd.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
