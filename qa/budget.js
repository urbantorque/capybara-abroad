async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)

  const TRI_BUDGET = 130000
  const MS_BUDGET = 5.5          // a third of a frame, for everything one
                                 // chapter draws. Nothing is near it.
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const rows = []
  for (const n of ALL) {
    rows.push(await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)

      // ---- the count. NOT renderer.info: with the post chain in place a read
      // after a frame returns the composite quad, 1 call and 1 triangle. This
      // walks the scene and respects the whole visibility chain.
      let tris = 0, shadow = 0, meshes = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        meshes++
        const t = (gm.index ? gm.index.count / 3
                            : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)) *
                  (o.isInstancedMesh ? o.count : 1)
        tris += t
        if (o.castShadow) shadow += t
      })

      // ---- the cost
      const gl = g.renderer.getContext()
      const render = () => {
        if (g.post && g.post.enabled) g.post.render()
        else g.renderer.render(g.scene, g.camera)
      }
      render(); gl.finish()
      const N = 40
      let t0 = performance.now()
      for (let i = 0; i < N; i++) render()
      gl.finish()
      const full = (performance.now() - t0) / N
      const was = g.renderer.shadowMap.enabled
      g.renderer.shadowMap.enabled = false
      render(); gl.finish()
      t0 = performance.now()
      for (let i = 0; i < N; i++) render()
      gl.finish()
      const noShadow = (performance.now() - t0) / N
      g.renderer.shadowMap.enabled = was

      return { n: name, tris: Math.round(tris), shadowTris: Math.round(shadow),
               meshes, ms: +full.toFixed(2), msNoShadow: +noShadow.toFixed(2),
               shadowMs: +(full - noShadow).toFixed(2) }
    }, n))
  }

  const out = { triBudget: TRI_BUDGET, msBudget: MS_BUDGET, rows: rows,
                fail: [], warn: [] }
  for (const r of rows) {
    if (r.ms > MS_BUDGET) {
      out.fail.push('FAIL ' + r.n + ': ' + r.ms + ' ms of render per frame, over the ' +
                    MS_BUDGET + ' ms gate (' + r.tris + ' tris)')
    }
    if (r.tris > TRI_BUDGET) {
      out.warn.push('WARN ' + r.n + ': ' + r.tris + ' visible triangles, over the ' +
                    TRI_BUDGET + ' gate by ' + (r.tris - TRI_BUDGET) +
                    ' — but it renders in ' + r.ms + ' ms (' +
                    (r.ms / (r.tris / 100000)).toFixed(2) + ' ms per 100k)')
    }
  }
  rows.sort((a, b) => b.ms - a.ms)
  out.worst = rows[0]
  out.summary = out.fail.length + ' over the cost gate · ' + out.warn.length +
                ' over the triangle gate · worst chapter ' + rows[0].n + ' at ' +
                rows[0].ms + ' ms of a 16.67 ms frame'
  await page.evaluate(async (o) => { await fetch('/shot?name=budget.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
