async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const res = { err: null, audit: null, tris: 0, meshes: 0, progs: 0, calls: 0, on: {}, off: {} }
    try {
      res.audit = g.capy.coatAudit()

      // The character budget, so "no new draw calls" is measured not claimed.
      // `o.visible` alone is NOT enough: the ten costumes are hidden at the
      // GROUP and their own meshes are perfectly visible: true, and traverse
      // does not stop at an invisible node — the same trap capyBakeGhost
      // documents, and it counts a wardrobe into the bare animal's budget.
      let tris = 0, meshes = 0
      g.capy.group.traverse(o => {
        if (!o.isMesh || !o.visible || !o.geometry) return
        for (let q = o.parent; q && q !== g.capy.group; q = q.parent) if (!q.visible) return
        const p = o.geometry.attributes.position
        if (!p) return
        meshes++
        tris += (o.geometry.index ? o.geometry.index.count : p.count) / 3
      })
      res.tris = Math.round(tris); res.meshes = meshes

      // ---- OWN CAMERA. game.frameShot clamps distance to sysCAM_MIN (7 m),
      // which is four times too far to sample a 12 px box on a 40 cm back.
      // Render and read back in ONE evaluate.
      const W = 1280, H = 760
      g.renderer.setSize(W, H, false)
      const p = g.capy.position
      const my = (g.capy.model || g.capy.group).rotation.y
      const rc = document.createElement('canvas')
      rc.width = W; rc.height = H
      const rx = rc.getContext('2d', { willReadFrequently: true })

      function shoot(yawOff, dist, up, aimY, fov) {
        const ay = p.y + (aimY || 0)
        const yaw = my + yawOff
        const c = new T.PerspectiveCamera(fov || 30, W / H, 0.05, 400)
        c.position.set(p.x + Math.sin(yaw) * dist, ay + up, p.z + Math.cos(yaw) * dist)
        c.lookAt(p.x, ay, p.z); c.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        const dom = g.renderer.domElement
        const png = dom.toDataURL('image/png')
        rx.clearRect(0, 0, W, H); rx.drawImage(dom, 0, 0, W, H)
        return { png, d: rx.getImageData(0, 0, W, H).data,
                 calls: g.renderer.info.render.calls, tri: g.renderer.info.render.triangles }
      }
      // mean luminance of a box given in FRACTIONS of the frame: the adaptive
      // scaler leaves the canvas at 896, 1023 or 1280 wide in one session, so a
      // box in pixels samples a different part of the animal every run
      function box(d, fx, fy, r) {
        const cx = Math.round(fx * W), cy = Math.round(fy * H)
        let n = 0, L = 0
        for (let y = cy - r; y <= cy + r; y++)
          for (let x = cx - r; x <= cx + r; x++) {
            const i = (y * W + x) * 4
            L += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++
          }
        return Math.round(L / n * 100) / 100
      }
      // A CUT ACROSS THE ANIMAL, not two boxes. The gradient IS this profile;
      // two boxes only tell you that two facets differ, which they already did.
      function cutV(d, fx, y0, y1, n) {
        const a = []
        for (let i = 0; i < n; i++) a.push(box(d, fx, y0 + (y1 - y0) * i / (n - 1), 3))
        return a
      }
      function cutH(d, fy, x0, x1, n) {
        const a = []
        for (let i = 0; i < n; i++) a.push(box(d, x0 + (x1 - x0) * i / (n - 1), fy, 3))
        return a
      }

      const VIEWS = [
        // name, yaw off the animal's facing, distance, height, aim, fov
        ['side', Math.PI * 0.5, 3.20, 0.55, 0.16, 26],
        ['play', Math.PI * 0.82, 3.40, 1.55, 0.10, 26],
        ['top', Math.PI, 0.60, 3.10, 0.10, 26]
      ]

      // THE A/B. The coat lives in a buffer, so "before" is the same frame with
      // every colour set to white — exactly comparable, no second checkout, no
      // second lighting state and no second pose.
      const saved = []
      g.capy.group.traverse(o => {
        if (!o.isMesh || !o.geometry) return
        const c = o.geometry.attributes.color
        if (c) saved.push([c, Float32Array.from(c.array)])
      })
      function coat(on) {
        for (const [c, orig] of saved) {
          if (on) c.array.set(orig); else c.array.fill(1)
          c.needsUpdate = true
        }
      }

      for (const state of ['off', 'on']) {
        coat(state === 'on')
        const bag = res[state]
        for (const [name, yaw, dist, up, aimY, fov] of VIEWS) {
          const f = shoot(yaw, dist, up, aimY, fov)
          bag[name] = name === 'top'
            ? { cut: cutH(f.d, 0.50, 0.38, 0.62, 25) }
            : { cut: cutV(f.d, 0.50, 0.40, 0.62, 25) }
          res.calls = f.calls
          await fetch('/shot?name=R1-' + state + '-' + name, { method: 'POST', body: f.png })
        }
      }
      coat(true)
      res.progs = g.renderer.info.programs ? g.renderer.info.programs.length : null
      res.lastError = g.state && g.state.lastError ? String(g.state.lastError) : null
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })
  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R1-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
