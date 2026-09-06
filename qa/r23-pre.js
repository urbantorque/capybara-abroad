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
    const res = { err: null, tris: 0, meshes: 0, calls: 0, parts: [], px: {}, mat: {} }
    try {
      // ---- the budget, with the parent-visibility walk (a hidden costume's own
      // meshes are visible:true and traverse does not stop at an invisible node)
      let tris = 0, meshes = 0
      g.capy.group.traverse(o => {
        if (!o.isMesh || !o.visible || !o.geometry) return
        for (let q = o.parent; q && q !== g.capy.group; q = q.parent) if (!q.visible) return
        const p = o.geometry.attributes.position
        if (!p) return
        meshes++
        const t = (o.geometry.index ? o.geometry.index.count : p.count) / 3
        tris += t
        res.parts.push({ t: o.geometry.type, n: Math.round(t) })
      })
      res.tris = Math.round(tris); res.meshes = meshes

      // ---- find the three meshes the R3 measurement is about, by GEOMETRY, not
      // by name: nothing in the rig is named and a material match is ambiguous
      // (mNose is the pad, the mouth plate AND both brows).
      let pad = null, snout = null, skull = null
      g.capy.group.traverse(o => {
        if (!o.isMesh || !o.geometry) return
        const q = o.geometry.parameters || {}
        if (o.geometry.type === 'CylinderGeometry' && q.radialSegments === 4) pad = o
        if (o.geometry.type === 'BoxGeometry' && Math.abs(q.width - 0.325) < 1e-6) snout = o
        if (o.geometry.type === 'BoxGeometry' && Math.abs(q.width - 0.36) < 1e-6) skull = o
      })
      if (!pad || !snout || !skull) throw new Error('parts: ' + !!pad + !!snout + !!skull)
      res.mat.padSelf = !!(pad.material.userData && pad.material.userData.capySelf)
      res.mat.padVC = pad.material.vertexColors === true
      res.mat.snoutSelf = !!(snout.material.userData && snout.material.userData.capySelf)
      res.mat.padHex = '#' + pad.material.color.getHexString()
      res.mat.snoutHex = '#' + snout.material.color.getHexString()

      g.capy.group.updateWorldMatrix(true, true)
      const P = (m, x, y, z) => new T.Vector3(x, y, z).applyMatrix4(m.matrixWorld)
      const PTS = {
        padFront: P(pad, 0, 0, 0),
        padTop: P(pad, 0, 0.021, 0),
        muzzFront: P(snout, 0, -0.055, 0.131),
        muzzTop: P(snout, 0, 0.101, 0),
        skullTop: P(skull, 0, 0.161, 0)
      }
      // the pad's top face normal in world, and the sun: the roadmap's first
      // suspect is that this face takes the sun square on
      const nm = new T.Matrix3().getNormalMatrix(pad.matrixWorld)
      const nTop = new T.Vector3(0, 1, 0).applyMatrix3(nm).normalize()
      let sun = null
      g.scene.traverse(o => { if (o.isDirectionalLight && !sun) sun = o })
      if (sun) {
        const sd = sun.position.clone().sub(sun.target ? sun.target.position : new T.Vector3()).normalize()
        res.mat.sunDotPadTop = Math.round(nTop.dot(sd) * 1000) / 1000
        res.mat.sunY = Math.round(sd.y * 1000) / 1000
        res.mat.sunI = sun.intensity
      }

      const W = 1280, H = 760
      g.renderer.setSize(W, H, false)
      const rc = document.createElement('canvas')
      rc.width = W; rc.height = H
      const rx = rc.getContext('2d', { willReadFrequently: true })
      const aim = PTS.padFront.clone()
      const my = (g.capy.model || g.capy.group).rotation.y

      function shoot(yawOff, dist, up, fov) {
        const yaw = my + yawOff
        const c = new T.PerspectiveCamera(fov, W / H, 0.02, 400)
        c.position.set(aim.x + Math.sin(yaw) * dist, aim.y + up, aim.z + Math.cos(yaw) * dist)
        c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        const dom = g.renderer.domElement
        const png = dom.toDataURL('image/png')
        rx.clearRect(0, 0, W, H); rx.drawImage(dom, 0, 0, W, H)
        return { png, c, d: rx.getImageData(0, 0, W, H).data,
                 calls: g.renderer.info.render.calls }
      }
      // Sample AT A PROJECTED MODEL POINT, not at a fraction of the frame: the
      // question is "is this pad darker than the muzzle it sits on", and only
      // the projection knows where either one landed.
      function at(f, v, r) {
        const p = v.clone().project(f.c)
        const cx = Math.round((p.x * 0.5 + 0.5) * W), cy = Math.round((-p.y * 0.5 + 0.5) * H)
        if (cx < r || cy < r || cx >= W - r || cy >= H - r) return null
        let n = 0, L = 0
        for (let y = cy - r; y <= cy + r; y++)
          for (let x = cx - r; x <= cx + r; x++) {
            const i = (y * W + x) * 4
            L += 0.2126 * d(f, i) + 0.7152 * d(f, i + 1) + 0.0722 * d(f, i + 2); n++
          }
        return { L: Math.round(L / n * 100) / 100, x: cx, y: cy }
      }
      function d(f, i) { return f.d[i] }

      const VIEWS = [
        // the resting lens looks DOWN on the animal; the front is the arrival
        ['rest', 0.30, 0.82, 0.42, 26],
        ['front', 0.10, 0.72, 0.06, 26],
        ['prof', Math.PI * 0.5, 0.95, 0.12, 26]
      ]
      for (const [name, yaw, dist, up, fov] of VIEWS) {
        const f = shoot(yaw, dist, up, fov)
        res.calls = f.calls
        const bag = {}
        for (const k in PTS) { const s = at(f, PTS[k], 2); bag[k] = s && s.L }
        res.px[name] = bag
        await fetch('/shot?name=R23pre-' + name, { method: 'POST', body: f.png })
      }
      // ...and the body, for the top line R2 is about
      for (const [name, yaw, dist, up, fov] of [['side', Math.PI * 0.5, 3.2, 0.55, 26],
                                                ['rear3q', Math.PI * 0.78, 3.2, 0.95, 26]]) {
        const c = new T.PerspectiveCamera(fov, W / H, 0.05, 400)
        const p = g.capy.position
        const y2 = my + yaw
        c.position.set(p.x + Math.sin(y2) * dist, p.y + up, p.z + Math.cos(y2) * dist)
        c.lookAt(p.x, p.y + 0.16, p.z); c.updateMatrixWorld()
        g.renderer.render(g.scene, c)
        await fetch('/shot?name=R23pre-' + name, { method: 'POST',
          body: g.renderer.domElement.toDataURL('image/png') })
      }
      res.lastError = g.state && g.state.lastError ? String(g.state.lastError) : null
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })
  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R23pre-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
