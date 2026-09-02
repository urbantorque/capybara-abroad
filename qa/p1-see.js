async page => {
  const TAG = 'before'
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0',
                'Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote','Comma','Period','Slash']
  const STATIONS = []
  for (let i = 0; i < 19; i++) STATIONS.push({ name: 'ch' + (i + 1), key: KEYS[i], at: null })
  STATIONS.push({ name: 'fig-a', key: 'Digit1', at: [0, 51.5] })
  STATIONS.push({ name: 'fig-b', key: 'Digit1', at: [-19, 8] })

  await page.setViewportSize({ width: 1280, height: 720 })
  const out = []

  for (const st of STATIONS) {
    try {
      await page.goto('http://localhost:5188/')
      await page.waitForTimeout(5200)
      await page.keyboard.press(st.key)
      await page.waitForTimeout(4200)

      if (st.at) {
        await page.evaluate((a) => {
          const g = window.__capy
          const y = g.capy.position.y + 1.2
          g.capy.body.position.set(a[0], y, a[1])
          g.capy.body.velocity.set(0, 0, 0)
          if (g.capy.body.previousPosition) g.capy.body.previousPosition.copy(g.capy.body.position)
          if (g.capy.body.interpolatedPosition) g.capy.body.interpolatedPosition.copy(g.capy.body.position)
        }, st.at)
        await page.waitForTimeout(2500)
      }

      await page.waitForTimeout(6000)

      await page.evaluate(() => {
        window.__p1 = { n: 0, sum: 0, min: 1, low: 0 }
        window.__p1i = setInterval(() => {
          const g = window.__capy
          if (!g || !g.camInfo) return
          const c = g.camInfo.clear
          const s = window.__p1
          s.n++; s.sum += c
          if (c < s.min) s.min = c
          if (c < 0.95) s.low++
        }, 16)
      })
      await page.waitForTimeout(5000)
      const clear = await page.evaluate(() => {
        clearInterval(window.__p1i)
        const s = window.__p1
        return { n: s.n, mean: s.n ? s.sum / s.n : 1, min: s.min, lowFrac: s.n ? s.low / s.n : 0 }
      })

      const px = await page.evaluate(() => {
        const g = window.__capy
        const T = g.THREE
        const cam = g.camera, r = g.renderer
        const cv = r.domElement
        const gl = r.getContext()
        const W = cv.width, H = cv.height

        const p = new T.Vector3(g.capy.position.x, g.capy.position.y + 0.35, g.capy.position.z)
        const q = p.clone().project(cam)
        const cx = (q.x * 0.5 + 0.5) * W
        const cyTop = (1 - (q.y * 0.5 + 0.5)) * H
        const cy = H - cyTop

        const e = new T.Vector3(g.capy.position.x, g.capy.position.y + 0.35, g.capy.position.z)
        const d = e.distanceTo(cam.position)
        const halfWorld = 0.95
        const fovR = cam.fov * Math.PI / 180
        const pxPerM = (H * 0.5) / (Math.tan(fovR * 0.5) * Math.max(d, 0.5))
        let hw = Math.round(halfWorld * pxPerM * 1.6)
        hw = Math.max(40, Math.min(hw, 300))

        let x0 = Math.round(cx - hw), y0 = Math.round(cy - hw)
        let w = hw * 2, h = hw * 2
        if (x0 < 0) { w += x0; x0 = 0 }
        if (y0 < 0) { h += y0; y0 = 0 }
        if (x0 + w > W) w = W - x0
        if (y0 + h > H) h = H - y0
        if (w < 8 || h < 8) return { bad: 'offscreen', ndc: [q.x, q.y] }

        const A = new Uint8Array(w * h * 4)
        const B = new Uint8Array(w * h * 4)
        function shoot(buf) {
          g.tick(1 / 600, true)
          gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
        }
        const grp = g.capy.group
        shoot(A)
        grp.visible = false
        shoot(B)
        grp.visible = true

        let soft = 0, hard = 0, sumA = 0, sumB = 0, sumAbs = 0
        const lum = (r8, g8, b8) => 0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8
        for (let i = 0; i < w * h; i++) {
          const o = i * 4
          const dr = Math.abs(A[o] - B[o]), dg = Math.abs(A[o + 1] - B[o + 1]), db = Math.abs(A[o + 2] - B[o + 2])
          const dd = dr + dg + db
          if (dd > 12) soft++
          if (dd > 45) {
            hard++
            const la = lum(A[o], A[o + 1], A[o + 2])
            const lb = lum(B[o], B[o + 1], B[o + 2])
            sumA += la
            sumB += lb
            sumAbs += Math.abs(la - lb)
          }
        }
        const area = w * h
        return {
          box: [x0, y0, w, h], area: area,
          softPx: soft, hardPx: hard,
          softFrac: soft / area, hardFrac: hard / area,
          lumaCapy: hard ? sumA / hard : 0,
          lumaBack: hard ? sumB / hard : 0,
          contrast: hard ? Math.abs(sumA / hard - sumB / hard) : 0,
          absLuma: hard ? sumAbs / hard : 0,
          camDist: d, ndc: [q.x, q.y]
        }
      })

      const who = await page.evaluate(() => {
        const g = window.__capy
        const c = g.hud && g.hud.canopyAudit ? g.hud.canopyAudit() : null
        return { biome: g.biome.current,
                 pos: [g.capy.position.x, g.capy.position.y, g.capy.position.z],
                 leafMeshes: c ? c.meshes : -1,
                 leafHits: c ? c.hits : -1,
                 rim: c ? c.rim : null,
                 animal: c ? c.animal : null }
      })

      await page.screenshot({ path: 'qa/p1-' + TAG + '-' + st.name + '.png' })
      out.push({ st: st.name, biome: who.biome, pos: who.pos, clear: clear, px: px,
                 leafMeshes: who.leafMeshes, leafHits: who.leafHits,
                 rim: who.rim, animal: who.animal })
    } catch (err) {
      out.push({ st: st.name, error: String(err && err.message || err) })
    }
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: s })
  }, { tag: 'p1-see-' + TAG, rows: out })
}
