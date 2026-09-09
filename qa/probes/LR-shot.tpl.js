async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async (SPOTS) => {
    const g = window.__capy
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    const wrap = a => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a }
    const res = []
    const size = () => {
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760
      g.camera.updateProjectionMatrix()
    }
    for (const s of SPOTS) {
      if (!g.biome.isActive(s.b)) {
        g.biome.switchTo(s.b)
        for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      }
      const b = g.capy.body
      const hold = () => {
        b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      }
      hold()
      for (let i = 0; i < 60; i++) { g.tick(1 / 60, false); if (!s.free) hold() }
      // ---- STEER THE REAL RIG -------------------------------------------
      // input.camYaw is an OUTPUT (systems.js writes it at the end of the
      // camera update for capybara.js to read); writing it does nothing at all
      // and every shot comes out facing the same way. Z and X are the yaw keys,
      // so a shot turns the camera the way a player would.
      if (s.yaw !== undefined) {
        for (let i = 0; i < 900; i++) {
          const d = wrap(s.yaw - g.input.camYaw)
          if (Math.abs(d) < 0.02) break
          const k = d > 0 ? 'KeyZ' : 'KeyX'
          down(k); g.tick(1 / 60, false); up(k)
          if (!s.free) hold()
        }
      }
      for (let i = 0; i < (s.hold || 120); i++) { g.tick(1 / 60, false); if (!s.free) hold() }
      size()
      g.tick(1 / 60, true)
      // IS THE CAMERA INSIDE SOMETHING? a grazing camera produces artefacts
      // that look exactly like geometry bugs, so the clearance is reported with
      // the picture and a bad one is thrown away rather than diagnosed.
      const c = g.camera.position
      const api = g[s.b] || g.env
      let th = null
      try { th = api && api.terrainHeight ? api.terrainHeight(c.x, c.z) : null } catch (e) { th = null }
      const url = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + s.n + '.png', { method: 'POST', body: url.split(',')[1] })
      res.push({ n: s.n, yaw: +g.input.camYaw.toFixed(2),
                 cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)],
                 clear: th === null ? null : +(c.y - th).toFixed(1),
                 err: g.state.lastError || null })
    }
    return res
  }, __SPOTS__)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=LR.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
