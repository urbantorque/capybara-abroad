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
    const res = { err: null, views: {} }
    try {
      let pad = null, snout = null
      g.capy.group.traverse(o => {
        if (!o.isMesh || !o.geometry) return
        const q = o.geometry.parameters || {}
        if (o.geometry.type === 'CylinderGeometry' && q.radialSegments === 4) pad = o
        if (o.geometry.type === 'BoxGeometry' && Math.abs(q.width - 0.325) < 1e-6) snout = o
      })
      if (!pad || !snout) throw new Error('parts')
      res.padSelf = !!(pad.material.userData && pad.material.userData.capySelf)
      res.snoutSelf = !!(snout.material.userData && snout.material.userData.capySelf)

      const W = 1280, H = 760
      g.renderer.setSize(W, H, false)
      const rc = document.createElement('canvas'); rc.width = W; rc.height = H
      const rx = rc.getContext('2d', { willReadFrequently: true })
      g.capy.group.updateWorldMatrix(true, true)
      const aim = new T.Vector3().setFromMatrixPosition(pad.matrixWorld)
      const my = (g.capy.model || g.capy.group).rotation.y

      function grab(v) {
        const yaw = my + v[0]
        const c = new T.PerspectiveCamera(v[3], W / H, 0.02, 400)
        c.position.set(aim.x + Math.sin(yaw) * v[1], aim.y + v[2], aim.z + Math.cos(yaw) * v[1])
        c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        rx.clearRect(0, 0, W, H); rx.drawImage(g.renderer.domElement, 0, 0, W, H)
        return rx.getImageData(0, 0, W, H).data
      }
      const s2l = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      const lum = c => Math.round((0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * 100) / 100

      // THE PAD IS WHATEVER PIXELS CHANGE WHEN THE PAD GOES AWAY. No projected
      // point, no guessed box. The mask is built ONCE, at the real colours, and
      // reused for the equal-albedo pass — where the pad barely differs from
      // what is behind it and a fresh diff would find almost nothing.
      function mask(v) {
        pad.visible = true; const on = grab(v)
        pad.visible = false; const off = grab(v)
        pad.visible = true
        const mk = new Uint8Array(W * H)
        let n = 0
        for (let i = 0, k = 0; k < W * H; k++, i += 4) {
          const dd = Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) +
                     Math.abs(on[i + 2] - off[i + 2])
          if (dd > 24) { mk[k] = 1; n++ }
        }
        // ...and the muzzle is the ring of unmarked pixels within 6 px of it
        const rg = new Uint8Array(W * H)
        let m = 0
        for (let y = 6; y < H - 6; y++)
          for (let x = 6; x < W - 6; x++) {
            const k = y * W + x
            if (mk[k]) continue
            let near = 0
            for (let dy = -6; dy <= 6 && !near; dy += 6)
              for (let dx = -6; dx <= 6 && !near; dx += 6)
                if (mk[k + dy * W + dx]) near = 1
            if (near) { rg[k] = 1; m++ }
          }
        return { mk, rg, n, m }
      }
      function mean(d, sel) {
        const A = [0, 0, 0]; let n = 0
        for (let k = 0, i = 0; k < W * H; k++, i += 4) {
          if (!sel[k]) continue
          A[0] += d[i]; A[1] += d[i + 1]; A[2] += d[i + 2]; n++
        }
        return n ? A.map(v => v / n) : [0, 0, 0]
      }
      // implied irradiance: the rendered LINEAR value divided by the albedo it
      // was multiplied by. Equal numbers say the pad is simply dark; a higher
      // one on the pad says something that is not albedo is lighting it.
      const E = (px, al) => [s2l(px[0]) / Math.max(al.r, 1e-4),
                             s2l(px[1]) / Math.max(al.g, 1e-4),
                             s2l(px[2]) / Math.max(al.b, 1e-4)].map(v => Math.round(v * 1000) / 1000)

      const VIEWS = { rest: [0.30, 0.82, 0.42, 26], front: [0.10, 0.72, 0.06, 26],
                      prof: [Math.PI * 0.5, 0.95, 0.12, 26] }
      const padHex = pad.material.color.getHex()
      for (const name in VIEWS) {
        const v = VIEWS[name]
        const M = mask(v)
        if (!M.n) { res.views[name] = { n: 0 }; continue }
        const d1 = grab(v)
        const P = mean(d1, M.mk), R = mean(d1, M.rg)
        pad.material.color.setHex(snout.material.color.getHex())
        const d2 = grab(v)
        const P2 = mean(d2, M.mk), R2 = mean(d2, M.rg)
        pad.material.color.setHex(padHex)
        // ...and the ADDITIVE term itself, exactly: a black albedo multiplies
        // every light term to zero, so whatever is left in the pixel is what
        // the shader ADDED. Nothing to infer.
        pad.material.color.setHex(0x000000)
        const d3 = grab(v)
        const P3 = mean(d3, M.mk)
        pad.material.color.setHex(padHex)
        const snoutHex = snout.material.color.getHex()
        snout.material.color.setHex(0x000000)
        const d4 = grab(v)
        const R4 = mean(d4, M.rg)
        snout.material.color.setHex(snoutHex)
        res.views[name] = {
          px: M.n, ring: M.m,
          padL: lum(P), muzzleL: lum(R),
          ratio: Math.round(lum(P) / lum(R) * 1000) / 1000,
          albedoRatio: Math.round(
            (0.2126 * pad.material.color.r + 0.7152 * pad.material.color.g + 0.0722 * pad.material.color.b) /
            (0.2126 * snout.material.color.r + 0.7152 * snout.material.color.g + 0.0722 * snout.material.color.b) * 1000) / 1000,
          equalPadL: lum(P2), equalMuzzleL: lum(R2),
          equalRatio: Math.round(lum(P2) / lum(R2) * 1000) / 1000,
          Epad: E(P, pad.material.color), Emuzzle: E(R, snout.material.color),
          addPadL: lum(P3), addMuzzleL: lum(R4),
          addFracPad: Math.round(s2l(lum(P3)) / s2l(lum(P)) * 1000) / 1000,
          addFracMuzzle: Math.round(s2l(lum(R4)) / s2l(lum(R)) * 1000) / 1000
        }
        await fetch('/shot?name=PADWHY-' + name, { method: 'POST',
          body: g.renderer.domElement.toDataURL('image/png') })
      }
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })
  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=PADWHY-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
