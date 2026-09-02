async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const errs = []
  page.on('pageerror', e => errs.push(String(e.message || e)))

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4500)

  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(-26, g.capy.position.y + 1.2, -6)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(3000)

  const samples = []
  for (let leg = 0; leg < 30; leg++) {
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1100)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(450)

    const one = await page.evaluate(() => {
      const g = window.__capy
      const T = g.THREE
      const cam = g.camera, r = g.renderer
      const cv = r.domElement, gl = r.getContext()
      const W = cv.width, H = cv.height
      const audit = g.hud.canopyAudit ? g.hud.canopyAudit() : null
      const p = new T.Vector3(g.capy.position.x, g.capy.position.y + 0.35, g.capy.position.z)
      const q = p.clone().project(cam)
      const cx = (q.x * 0.5 + 0.5) * W
      const cy = H - (1 - (q.y * 0.5 + 0.5)) * H
      const d = p.distanceTo(cam.position)
      const pxPerM = (H * 0.5) / (Math.tan(cam.fov * Math.PI / 360) * Math.max(d, 0.5))
      let hw = Math.max(40, Math.min(Math.round(0.95 * pxPerM * 1.6), 300))
      let x0 = Math.max(0, Math.round(cx - hw)), y0 = Math.max(0, Math.round(cy - hw))
      let w = Math.min(hw * 2, W - x0), h = Math.min(hw * 2, H - y0)
      if (w < 8 || h < 8) return { bad: 1, ndc: [q.x, q.y], clear: g.camInfo.clear }
      const A = new Uint8Array(w * h * 4), B = new Uint8Array(w * h * 4)
      function shoot(buf) { g.tick(1 / 600, true); gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf) }
      function measure() {
        shoot(A); g.capy.group.visible = false; shoot(B); g.capy.group.visible = true
        let hard = 0
        for (let i = 0; i < w * h; i++) {
          const o = i * 4
          const dd = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2])
          if (dd > 45) hard++
        }
        return hard
      }
      g.state.noCut = true
      const off = measure()
      g.state.noCut = false
      const on = measure()
      return { pos: [g.capy.position.x, g.capy.position.z], clear: g.camInfo.clear, dist: d,
               ndcY: q.y, hits: audit ? audit.hits : -1, off: off, on: on }
    })
    samples.push(one)
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p1-walk.json', { method: 'POST', body: s })
  }, { samples: samples, errs: errs })
}
