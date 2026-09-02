async page => {
  const STATIONS = [
    { name: 'fig-under', key: 'Digit1', at: [-19, 8] },
    { name: 'fig-near', key: 'Digit1', at: [0, 51.5] },
    { name: 'fig-mid', key: 'Digit1', at: [-19, 14] },
    { name: 'goreme', key: 'BracketLeft', at: null },
    { name: 'kyoto', key: 'Digit4', at: null },
    { name: 'pantanal', key: 'Semicolon', at: null }
  ]
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
        if (w < 8 || h < 8) return { bad: 'offscreen', ndc: [q.x, q.y] }
        const A = new Uint8Array(w * h * 4), B = new Uint8Array(w * h * 4)
        const lum = (r8, g8, b8) => 0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8
        function shoot(buf) { g.tick(1 / 600, true); gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf) }
        function measure() {
          shoot(A); g.capy.group.visible = false; shoot(B); g.capy.group.visible = true
          let hard = 0, sAbs = 0
          for (let i = 0; i < w * h; i++) {
            const o = i * 4
            const dd = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2])
            if (dd > 45) {
              hard++
              sAbs += Math.abs(lum(A[o], A[o + 1], A[o + 2]) - lum(B[o], B[o + 1], B[o + 2]))
            }
          }
          return { hardPx: hard, absLuma: hard ? sAbs / hard : 0 }
        }
        const audit = g.hud.canopyAudit ? g.hud.canopyAudit() : null
        g.state.noCut = true
        const off = measure()
        g.state.noCut = false
        const on = measure()
        return {
          biome: g.biome.current, box: [x0, y0, w, h], camDist: d, ndc: [q.x, q.y],
          clear: g.camInfo.clear,
          leafMeshes: audit ? audit.meshes : -1, leafHits: audit ? audit.hits : -1,
          nearest: audit ? audit.nearest : -1, rayLen: audit ? audit.len : -1,
          cutOff: off, cutOn: on,
          gain: off.hardPx > 0 ? (on.hardPx / off.hardPx) : (on.hardPx > 0 ? Infinity : 1)
        }
      })

      await page.evaluate(() => { window.__capy.state.noCut = true })
      await page.waitForTimeout(400)
      await page.screenshot({ path: 'qa/p1-ab-' + st.name + '-off.png' })
      await page.evaluate(() => { window.__capy.state.noCut = false })
      await page.waitForTimeout(400)
      await page.screenshot({ path: 'qa/p1-ab-' + st.name + '-on.png' })

      out.push(Object.assign({ st: st.name }, row))
    } catch (err) {
      out.push({ st: st.name, error: String(err && err.message || err) })
    }
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p1-ab.json', { method: 'POST', body: s })
  }, { rows: out, errs: errs })
}
