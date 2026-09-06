async page => {
  // R6. DID THE SECOND COLOUR LAND, AND WHAT DID IT COST?
  //
  // Two questions and they need different instruments.
  //
  //  1. THE COST. A `color` attribute on a buffer that already had one, on a
  //     material that already has `vertexColors`, must add exactly zero draw
  //     calls. Counted off renderer.info in three chapters, and counted again
  //     with every second colour scrubbed back to 1 in place, so the two
  //     numbers come from the same frame of the same build.
  //  2. DID IT LAND. Scrubbing the attribute is also the A/B: put every
  //     multiplier back to 1, render, and diff. A colour that changes nothing
  //     is a colour that is not being read, which is the failure mode this
  //     whole mechanism has (a `color` attribute on a material without
  //     `vertexColors` is silently ignored, and the reverse renders BLACK).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const out = { errs: [], chapters: {} }

  const measure = (name) => page.evaluate(async (name) => {
    const g = window.__capy, T = g.THREE
    const res = { err: null, biome: g.biome && g.biome.current }
    try {
      const W = 900, H = 560
      g.renderer.setSize(W, H, false)
      // Everything in the scene that carries a `color` attribute with anything
      // but 1 in it. That set IS the change, and holding it lets the same run
      // report both the cost and the effect.
      // ...and ONLY THE ROSTER: the first cut of this scrubbed every vertex
      // colour in the scene, which is most of the world, and reported 83% of
      // the frame changing. The npc instanced meshes all share one material,
      // mat(sail, vertexColors), so that is the filter.
      const painted = []
      g.scene.traverse(o => {
        if (!o.isInstancedMesh || !o.geometry || !o.material) return
        if (!o.material.vertexColors || o.material.color.getHex() !== 0xfaf6ec) return
        const c = o.geometry.attributes.color
        if (!c) return
        let off = false
        for (let i = 0; i < c.array.length; i++) if (c.array[i] !== 1) { off = true; break }
        if (off) painted.push({ m: o, was: Float32Array.from(c.array) })
      })
      res.paintedMeshes = painted.length

      const cam = g.camera
      const grab = () => {
        g.renderer.info.reset()
        g.renderer.render(g.scene, cam)
        const calls = g.renderer.info.render.calls, tris = g.renderer.info.render.triangles
        const t = document.createElement('canvas')
        t.width = W; t.height = H
        t.getContext('2d').drawImage(g.renderer.domElement, 0, 0)
        return { calls, tris, px: t.getContext('2d').getImageData(0, 0, W, H).data }
      }
      const on = grab()
      // ...scrubbed: every multiplier back to 1, in place
      for (const p of painted) {
        p.m.geometry.attributes.color.array.fill(1)
        p.m.geometry.attributes.color.needsUpdate = true
      }
      const off = grab()
      for (const p of painted) {
        p.m.geometry.attributes.color.array.set(p.was)
        p.m.geometry.attributes.color.needsUpdate = true
      }
      let n = 0, d = 0
      for (let i = 0; i < on.px.length; i += 4) {
        const la = 0.299 * on.px[i] + 0.587 * on.px[i + 1] + 0.114 * on.px[i + 2]
        const lb = 0.299 * off.px[i] + 0.587 * off.px[i + 1] + 0.114 * off.px[i + 2]
        if (Math.abs(la - lb) < 2) continue
        n++; d += lb - la
      }
      res.callsOn = on.calls; res.callsOff = off.calls
      res.trisOn = on.tris; res.trisOff = off.tris
      res.pxChanged = n
      res.meanDarker = n ? Math.round(d / n * 100) / 100 : 0
      res.frame = W * H
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  }, name)

  out.chapters.sydney = await measure('sydney')

  for (const [key, name] of [['Semicolon', 'venice'], ['Digit8', 'sahara']]) {
    await page.evaluate(n => window.__capy.biome.switchTo(n), name)
    await page.waitForTimeout(8000)
    out.chapters[name] = await measure(name)
  }

  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R6-colour.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
