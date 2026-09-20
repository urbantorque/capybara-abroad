async page => {
  // ROADMAP-WOW2 V1.5 — THE BEADS. At rest with the resting lens open (THE
  // REGARD up), how far each catchlight has slid off its authored place
  // toward the lens, live against `noAlive`; and a close frame of the face
  // from the lens's own side, both arms, read by eye.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  const out = { errs, arms: {} }
  for (const arm of ['live', 'cut']) {
    const r = await page.evaluate((arm) => {
      const g = window.__capy, T = g.THREE
      g.state.noAlive = arm === 'cut'
      g.capy.wake(60)
      // twelve seconds of rest for the crane to open and the regard to arrive
      // (real frames, not ticks: the lens is systems.js's and it wants time)
      return new Promise(res => {
        const t0 = performance.now()
        const step = () => {
          if (performance.now() - t0 < 12000) { requestAnimationFrame(step); return }
          const a = g.capy.animAudit()
          const ci = g.camInfo || {}
          // the face, from the lens's side: the camera's own bearing, 1.6 m out
          const p = g.capy.position, cp = g.camera.position
          const dx = cp.x - p.x, dz = cp.z - p.z, m = Math.hypot(dx, dz) || 1
          // the head sits 0.26 m ahead of the body centre and ~0.2 m up on a
          // loafing animal; the lens goes 1.7 m out from THAT along the
          // camera's bearing, at the head's height, and looks at the head
          const yaw = g.capy.group ? g.capy.group.rotation.y : 0
          const hx = p.x + Math.sin(yaw) * 0.26, hz = p.z + Math.cos(yaw) * 0.26, hy = p.y + 0.18
          const c = new T.PerspectiveCamera(26, 1280 / 760, 0.05, 400)
          c.position.set(hx + dx / m * 1.7, hy + 0.15, hz + dz / m * 1.7)
          c.lookAt(hx, hy, hz); c.updateMatrixWorld()
          g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c); g.renderer.render(g.scene, c)
          window.__catchShot = g.renderer.domElement.toDataURL('image/png')
          res({ regard: a.regard, catchL: a.catchL, catchR: a.catchR, rest: +(ci.rest || 0).toFixed(2), dist: +(ci.dist || 0).toFixed(1), rung: g.state.perfRung })
        }
        requestAnimationFrame(step)
      })
    }, arm)
    out.arms[arm] = r
    const url = await page.evaluate(() => window.__catchShot)
    if (url) await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: 'wow2-catch-' + arm, u: url })
  }
  await page.evaluate(() => { window.__capy.state.noAlive = false })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-catch.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
