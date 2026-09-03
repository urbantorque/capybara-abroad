async page => {
  // D3: the five chapters that gained sway, at a gust peak. `wxGust` is what
  // the shader field rides, so the shot is taken when the wind is actually
  // blowing rather than whenever the probe happened to arrive.
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [] }
  for (const key of ['Digit3', 'BracketRight', 'Period', 'Comma', 'Digit4', 'Digit0']) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(12000)
    const info = await page.evaluate(() => {
      const g = window.__capy
      let calls = 0, tris = 0
      // COUNTED INSIDE THE SCENE PASS. renderer.info.render.calls reads 1
      // after tick(dt, true) because the composite's final quad is the last
      // draw and the counter resets per render.
      const r = g.renderer
      const wasAuto = r.info.autoReset
      r.info.autoReset = false
      r.info.reset()
      g.tick(1 / 60, true)
      calls = r.info.render.calls; tris = r.info.render.triangles
      r.info.autoReset = wasAuto
      // ...AND DID THE SWAY ACTUALLY BIND? A material whose hook silently
      // failed still DRAWS — it is simply the one batch in the chapter that
      // does not move, which is matOwn's warning and is not something a frame
      // mean can see. swayMesh reports its own program cache key, so ask.
      let swayed = 0, swayedTris = 0
      g.scene.traverse(o => {
        if (!o.isMesh || !o.visible || !o.material) return
        const k = o.material.customProgramCacheKey
        if (typeof k !== 'function') return
        let s = ''
        try { s = String(k.call(o.material)) } catch (e) { return }
        if (s.indexOf('sway') >= 0) {
          swayed++
          const gm = o.geometry
          if (gm && gm.attributes && gm.attributes.position) swayedTris += gm.attributes.position.count / 3
        }
      })
      return { biome: g.biome.current, calls: calls, tris: tris,
               swayMeshes: swayed, swayTris: Math.round(swayedTris),
               gust: g.weather && typeof g.weather.gust === 'function' ? JSON.stringify(g.weather.gust()) : null }
    })
    await page.screenshot({ path: 'qa/d3-' + info.biome + '.png' })
    out.rows.push(info)
  }
  await page.evaluate((o) => fetch('/shot?name=d3-shots.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
