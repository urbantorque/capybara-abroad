async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0',
                'Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote','Comma','Period','Slash']
  await page.setViewportSize({ width: 1280, height: 720 })
  const out = []
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  for (let i = 0; i < 19; i++) {
    try {
      await page.goto('http://localhost:5188/')
      await page.waitForTimeout(5200)
      await page.keyboard.press(KEYS[i])
      await page.waitForTimeout(4200)
      await page.waitForTimeout(7000)

      const row = await page.evaluate(() => {
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
        if (w < 8 || h < 8) return { bad: 1 }
        const A = new Uint8Array(w * h * 4), B = new Uint8Array(w * h * 4)
        const lum = (a, b, c) => 0.2126 * a + 0.7152 * b + 0.0722 * c
        function shoot(buf) { g.tick(1 / 600, true); gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf) }
        function measure() {
          shoot(A); g.capy.group.visible = false; shoot(B); g.capy.group.visible = true
          let hard = 0, sAbs = 0, edge = 0, sEdge = 0
          for (let i2 = 0; i2 < w * h; i2++) {
            const o = i2 * 4
            const dd = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2])
            if (dd > 45) {
              const la = lum(A[o], A[o + 1], A[o + 2]), lb = lum(B[o], B[o + 1], B[o + 2])
              hard++; sAbs += Math.abs(la - lb)
              if (Math.abs(la - lb) > 25) { edge++; sEdge += Math.abs(la - lb) }
            }
          }
          return { hardPx: hard, absLuma: hard ? sAbs / hard : 0,
                   edgePx: edge, edgeFrac: hard ? edge / hard : 0 }
        }
        const rimOn = g.hud.canopyAudit ? g.hud.canopyAudit().rim : null
        g.state.noSelfRim = true
        const off = measure()
        g.state.noSelfRim = false
        const on = measure()
        return { biome: g.biome.current, camDist: d, selfK: rimOn ? rimOn.self : -1,
                 off: off, on: on,
                 dAbs: on.absLuma - off.absLuma, dEdge: on.edgeFrac - off.edgeFrac }
      })
      out.push(row)
    } catch (err) {
      out.push({ i: i, error: String(err && err.message || err) })
    }
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p1-rim.json', { method: 'POST', body: s })
  }, { rows: out, errs: errs })
}
