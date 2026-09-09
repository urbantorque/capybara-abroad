async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const errs = []
  page.on('pageerror', e => errs.push(String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4500)

  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(-19, g.capy.position.y + 1.2, 8)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(8000)

  const a = await page.evaluate(() => {
    const g = window.__capy
    const c = g.hud.canopyAudit ? g.hud.canopyAudit() : { none: true }
    return { canopy: c, clear: g.camInfo.clear,
             pos: [g.capy.position.x, g.capy.position.y, g.capy.position.z] }
  })
  await page.screenshot({ path: 'qa/p1-smoke-fig.png' })

  const px = await page.evaluate(() => {
    const g = window.__capy
    const T = g.THREE
    const cam = g.camera, r = g.renderer
    const cv = r.domElement, gl = r.getContext()
    const W = cv.width, H = cv.height
    const p = new T.Vector3(g.capy.position.x, g.capy.position.y + 0.35, g.capy.position.z)
    const q = p.clone().project(cam)
    const cx = (q.x * 0.5 + 0.5) * W
    const cy = H - (1 - (q.y * 0.5 + 0.5)) * H
    const d = p.distanceTo(cam.position)
    const pxPerM = (H * 0.5) / (Math.tan(cam.fov * Math.PI / 360) * Math.max(d, 0.5))
    let hw = Math.max(40, Math.min(Math.round(0.95 * pxPerM * 1.6), 300))
    let x0 = Math.max(0, Math.round(cx - hw)), y0 = Math.max(0, Math.round(cy - hw))
    let w = Math.min(hw * 2, W - x0), h = Math.min(hw * 2, H - y0)
    const A = new Uint8Array(w * h * 4), B = new Uint8Array(w * h * 4)
    function shoot(buf) { g.tick(1 / 600, true); gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf) }
    shoot(A); g.capy.group.visible = false; shoot(B); g.capy.group.visible = true
    let hard = 0, sa = 0, sb = 0
    const lum = (r8, g8, b8) => 0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8
    for (let i = 0; i < w * h; i++) {
      const o = i * 4
      const dd = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2])
      if (dd > 45) { hard++; sa += lum(A[o], A[o + 1], A[o + 2]); sb += lum(B[o], B[o + 1], B[o + 2]) }
    }
    return { hardPx: hard, contrast: hard ? Math.abs(sa / hard - sb / hard) : 0, box: [x0, y0, w, h] }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p1-smoke.json', { method: 'POST', body: s })
  }, { a: a, px: px, errs: errs })
}
