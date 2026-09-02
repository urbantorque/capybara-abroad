async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs: [], ch: {} }

  // A FIXED camera at a FIXED world point, so the two halves of the A/B are
  // comparable. Crowd members wander, so this is repeated over a ring of eight
  // bearings and summed: one bearing is a lottery, eight is a measurement.
  const JOBS = [['sydney', 'Digit1', 0, 0], ['venice', 'Digit0', 0, 0], ['sahara', 'Digit8', 0, 0]]
  for (const [name, key] of JOBS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(8000)
    out.ch[name] = await page.evaluate(async () => {
      const g = window.__capy
      const T = g.THREE
      const p = g.capy.position
      let calls = 0, tris = 0
      const cam = new T.PerspectiveCamera(50, 1280 / 760, 0.05, 500)
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4
        cam.position.set(p.x + Math.sin(a) * 12, p.y + 3.2, p.z + Math.cos(a) * 12)
        cam.lookAt(p.x, p.y + 1.2, p.z)
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, cam)
        calls += g.renderer.info.render.calls
        tris += g.renderer.info.render.triangles
      }
      // ...and the total object count in the scene, which does not depend on
      // where anybody happens to be standing.
      let meshes = 0, inst = 0
      g.scene.traverse((o) => {
        if (o.isInstancedMesh) inst++
        else if (o.isMesh) meshes++
      })
      return { biome: g.biome.current, calls: calls, tris: tris, meshes: meshes, inst: inst,
               locals: (g.locals || []).filter(l => l.biome === g.biome.current && l.fig).length }
    })
  }
  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p5-cost.json', { method: 'POST', body: s })
  }, out)
}
