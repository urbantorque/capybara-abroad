async page => {
  // R1 AGAINST P1. The rule the coat must not break is the one P1 bought: the
  // animal has to be findable against the ground it is standing on. A dorsal
  // gradient darkens the top of the silhouette, and from a camera 35 degrees
  // above and behind, the top of the silhouette is most of it — so this is not
  // a theoretical risk.
  //
  // Same measurement as qa/p1-see.js, and deliberately the same code: render
  // the animal, hide it, render again, and take the mean luminance difference
  // over the pixels that changed hard. Run TWICE per chapter with the colour
  // buffers flattened in between, so the before and the after are the same
  // frame, the same light and the same pose — which no comparison against a
  // recorded table from an earlier build can be.
  const STATIONS = [
    ['sydney', 'Digit1'], ['cali', 'Digit5'],
    ['sahara', 'Digit8'], ['antarctic', 'Comma']
  ]
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 720 })
  const out = []

  for (const [name, key] of STATIONS) {
    try {
      await page.goto('http://localhost:5188/')
      await page.waitForTimeout(5200)
      await page.keyboard.press(key)
      await page.waitForTimeout(9000)

      const r = await page.evaluate(() => {
        const g = window.__capy, T = g.THREE
        const cam = g.camera, r = g.renderer
        const cv = r.domElement, gl = r.getContext()
        const W = cv.width, H = cv.height

        const p = new T.Vector3(g.capy.position.x, g.capy.position.y + 0.35, g.capy.position.z)
        const q = p.clone().project(cam)
        const cx = (q.x * 0.5 + 0.5) * W
        const cy = H - (1 - (q.y * 0.5 + 0.5)) * H
        const d = p.distanceTo(cam.position)
        const pxPerM = (H * 0.5) / (Math.tan(cam.fov * Math.PI / 360) * Math.max(d, 0.5))
        let hw = Math.round(0.95 * pxPerM * 1.6)
        hw = Math.max(40, Math.min(hw, 300))
        let x0 = Math.round(cx - hw), y0 = Math.round(cy - hw), w = hw * 2, h = hw * 2
        if (x0 < 0) { w += x0; x0 = 0 }
        if (y0 < 0) { h += y0; y0 = 0 }
        if (x0 + w > W) w = W - x0
        if (y0 + h > H) h = H - y0
        if (w < 8 || h < 8) return { bad: 'offscreen' }

        const saved = []
        g.capy.group.traverse(o => {
          if (!o.isMesh || !o.geometry) return
          const c = o.geometry.attributes.color
          if (c) saved.push([c, Float32Array.from(c.array)])
        })
        const coat = on => {
          for (const [c, orig] of saved) {
            if (on) c.array.set(orig); else c.array.fill(1)
            c.needsUpdate = true
          }
        }

        const A = new Uint8Array(w * h * 4), B = new Uint8Array(w * h * 4)
        const lum = (r8, g8, b8) => 0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8
        function shoot(buf) {
          g.tick(1 / 600, true)
          gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
        }
        function measure() {
          const grp = g.capy.group
          shoot(A); grp.visible = false; shoot(B); grp.visible = true
          let hard = 0, sumA = 0, sumB = 0
          for (let i = 0; i < w * h; i++) {
            const o = i * 4
            const dd = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2])
            if (dd > 45) {
              hard++
              sumA += lum(A[o], A[o + 1], A[o + 2])
              sumB += lum(B[o], B[o + 1], B[o + 2])
            }
          }
          return { hard,
                   capy: hard ? sumA / hard : 0,
                   back: hard ? sumB / hard : 0,
                   contrast: hard ? Math.abs(sumA / hard - sumB / hard) : 0 }
        }
        coat(false); const off = measure()
        coat(true); const on = measure()
        return { off, on, dist: d, rim: g.rimInfo ? g.rimInfo() : null,
                 lastError: g.state && g.state.lastError ? String(g.state.lastError) : null }
      })
      out.push(Object.assign({ name }, r))
    } catch (e) { out.push({ name, err: String((e && e.message) || e) }) }
  }

  await page.evaluate(async o => {
    await fetch('/shot?name=R1-silh.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { rows: out, errs })
}
