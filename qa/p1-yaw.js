async page => {
  const STATIONS = [
    { name: 'figs', key: 'Digit1', at: [-19, 8] },
    { name: 'lawn', key: 'Digit1', at: [0, 51.5] },
    { name: 'goreme', key: 'BracketLeft', at: null },
    { name: 'kyoto', key: 'Digit4', at: null }
  ]
  const STEPS = 24
  await page.setViewportSize({ width: 1280, height: 720 })
  const out = []
  const errs = []
  page.on('pageerror', e => errs.push(String(e.message || e)))

  for (const st of STATIONS) {
    try {
      await page.goto('http://localhost:5188/')
      await page.waitForTimeout(5200)
      await page.keyboard.press(st.key)
      await page.waitForTimeout(4200)
      if (st.at) {
        await page.evaluate((a) => {
          const g = window.__capy
          g.capy.body.position.set(a[0], g.capy.position.y + 1.2, a[1])
          g.capy.body.velocity.set(0, 0, 0)
        }, st.at)
        await page.waitForTimeout(2500)
      }
      await page.waitForTimeout(4000)

      const samples = []
      for (let s = 0; s < STEPS; s++) {
        await page.mouse.move(640, 400)
        await page.mouse.down()
        await page.mouse.move(640 + 70, 400, { steps: 6 })
        await page.mouse.up()
        await page.waitForTimeout(900)

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
          if (w < 8 || h < 8) return { bad: 1, yaw: g.input.camYaw, hits: audit ? audit.hits : -1 }
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
          return { yaw: g.input.camYaw, clear: g.camInfo.clear, dist: d,
                   hits: audit ? audit.hits : -1, nearest: audit ? audit.nearest : -1,
                   off: off, on: on }
        })
        samples.push(one)
      }
      out.push({ st: st.name, samples: samples })
    } catch (err) {
      out.push({ st: st.name, error: String(err && err.message || err) })
    }
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p1-yaw.json', { method: 'POST', body: s })
  }, { rows: out, errs: errs })
}
