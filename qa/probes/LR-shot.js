async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const spots = JSON.parse(await page.evaluate(() => document.title) ? '[]' : '[]')
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const S = window.__LRSPOTS
    const res = []
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280 / 760
    g.camera.updateProjectionMatrix()
    for (const s of S) {
      if (!g.biome.isActive(s.b)) {
        g.biome.switchTo(s.b)
        for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      }
      const b = g.capy.body
      b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (s.yaw !== undefined) { g.input.camYaw = s.yaw; g.input.camYawTarget = s.yaw }
      // let the real rig settle, holding the animal in place
      for (let i = 0; i < (s.hold || 150); i++) {
        g.tick(1 / 60, false)
        if (!s.free) {
          b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        }
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760
      g.camera.updateProjectionMatrix()
      g.tick(1 / 60, true)
      // IS THE CAMERA INSIDE SOMETHING? a grazing camera produces artefacts
      // that look exactly like geometry bugs. Report the clearance so the
      // picture can be thrown away rather than diagnosed.
      const c = g.camera.position
      const api = g[s.b] || g.env
      let th = null
      try { th = api && api.terrainHeight ? api.terrainHeight(c.x, c.z) : null } catch (e) { th = null }
      const url = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + s.n + '.png', { method: 'POST', body: url.split(',')[1] })
      res.push({ n: s.n, cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)],
                 terr: th === null ? null : +th.toFixed(1),
                 clear: th === null ? null : +(c.y - th).toFixed(1),
                 err: g.state.lastError || null })
    }
    return res
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=LR.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
