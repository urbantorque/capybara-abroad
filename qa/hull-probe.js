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
    const res = { err: null, meshes: 0, tris: 0, calls: 0, progs: 0, audit: null,
                  top: null, pad: {}, errs: [] }
    try {
      res.audit = g.capy.coatAudit()
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

      let hull = null, muzzle = null, pad = null
      g.capy.group.traverse(o => {
        if (o.name === 'capyHull') hull = o
        if (o.name === 'capyMuzzle') muzzle = o
        if (o.name === 'capyPad') pad = o
      })
      if (!hull || !muzzle || !pad) throw new Error('parts ' + !!hull + !!muzzle + !!pad)
      res.pad.self = !!(pad.material.userData && pad.material.userData.capySelf)
      res.pad.vc = pad.material.vertexColors === true
      res.pad.hasColor = !!pad.geometry.attributes.color

      // THE TOP LINE, in model space. The whole point of R2 is that the animal
      // has ONE of these, rising to a peak over the hips — so measure it rather
      // than look at it: the highest vertex of the body in each 10 cm slice
      // along z, straight off the buffer.
      const pos = hull.geometry.attributes.position
      const slabs = {}
      const v = new T.Vector3()
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(hull.matrix)
        if (Math.abs(v.x) > 0.06) continue        // the centreline only
        const k = Math.round(v.z * 10) / 10
        if (slabs[k] === undefined || v.y > slabs[k]) slabs[k] = v.y
      }
      const keys = Object.keys(slabs).map(Number).sort((a, b) => b - a)
      res.top = keys.map(k => [k, Math.round(slabs[k] * 1000) / 1000])
      let hi = -9, hiZ = 0
      for (const k of keys) if (slabs[k] > hi) { hi = slabs[k]; hiZ = k }
      res.peak = [hiZ, Math.round(hi * 1000) / 1000]

      const W = 1280, H = 760
      g.renderer.setSize(W, H, false)
      const rc = document.createElement('canvas'); rc.width = W; rc.height = H
      const rx = rc.getContext('2d', { willReadFrequently: true })
      const my = (g.capy.model || g.capy.group).rotation.y
      const p = g.capy.position

      function shoot(aim, yawOff, dist, up, fov) {
        const yaw = my + yawOff
        const c = new T.PerspectiveCamera(fov, W / H, 0.02, 400)
        c.position.set(aim.x + Math.sin(yaw) * dist, aim.y + up, aim.z + Math.cos(yaw) * dist)
        c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        rx.clearRect(0, 0, W, H); rx.drawImage(g.renderer.domElement, 0, 0, W, H)
        return { png: g.renderer.domElement.toDataURL('image/png'),
                 d: rx.getImageData(0, 0, W, H).data, calls: g.renderer.info.render.calls }
      }
      const body = new T.Vector3(p.x, p.y + 0.16, p.z)
      g.capy.group.updateWorldMatrix(true, true)
      const headAim = new T.Vector3().setFromMatrixPosition(pad.matrixWorld)

      const SHOTS = [
        ['side', body, Math.PI * 0.5, 3.2, 0.55, 26],
        ['rear3q', body, Math.PI * 0.78, 3.2, 0.95, 26],
        ['front3q', body, Math.PI * 0.22, 3.2, 0.85, 26],
        ['play', body, Math.PI * 0.82, 3.4, 1.55, 26],
        ['head', headAim, 0.30, 0.82, 0.42, 26],
        ['face', headAim, 0.10, 0.72, 0.06, 26],
        ['prof', headAim, Math.PI * 0.5, 0.95, 0.12, 26]
      ]
      for (const s of SHOTS) {
        const f = shoot(s[1], s[2], s[3], s[4], s[5])
        res.calls = f.calls
        await fetch('/shot?name=R2-' + s[0], { method: 'POST', body: f.png })
      }

      // ---- THE PAD, the same instrument that found the problem -------------
      const s2l = x => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
      const lum = c => Math.round((0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * 100) / 100
      function padPass(name, aim, yawOff, dist, up, fov) {
        pad.visible = true
        const on = shoot(aim, yawOff, dist, up, fov).d
        pad.visible = false
        const off = shoot(aim, yawOff, dist, up, fov).d
        pad.visible = true
        const mk = new Uint8Array(W * H)
        let n = 0
        for (let i = 0, k = 0; k < W * H; k++, i += 4) {
          if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) +
              Math.abs(on[i + 2] - off[i + 2]) > 24) { mk[k] = 1; n++ }
        }
        if (!n) return { n: 0 }
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
        function mean(d, sel) {
          const A = [0, 0, 0]; let c = 0
          for (let k = 0, i = 0; k < W * H; k++, i += 4) {
            if (!sel[k]) continue
            A[0] += d[i]; A[1] += d[i + 1]; A[2] += d[i + 2]; c++
          }
          return c ? A.map(x => x / c) : [0, 0, 0]
        }
        const d1 = shoot(aim, yawOff, dist, up, fov).d
        const P = mean(d1, mk), R = mean(d1, rg)
        const hex = pad.material.color.getHex()
        pad.material.color.setHex(0x000000)
        const d3 = shoot(aim, yawOff, dist, up, fov).d
        const P3 = mean(d3, mk)
        pad.material.color.setHex(hex)
        return { n, padL: lum(P), muzzleL: lum(R),
                 ratio: Math.round(lum(P) / lum(R) * 1000) / 1000,
                 addFracPad: Math.round(s2l(lum(P3)) / s2l(lum(P)) * 1000) / 1000 }
      }
      res.pad.rest = padPass('rest', headAim, 0.30, 0.82, 0.42, 26)
      res.pad.front = padPass('front', headAim, 0.10, 0.72, 0.06, 26)
      res.pad.prof = padPass('prof', headAim, Math.PI * 0.5, 0.95, 0.12, 26)

      // ---- THE GRADIENT, off the buffer rather than off a frame -----------
      // R1's own probe samples fixed fractions of the frame, which were sited
      // against a body that no longer exists. The coat is a colour attribute:
      // read it where it lives, and the number is immune to framing, to the
      // pose and to which chapter is up.
      {
        const c = hull.geometry.attributes.color, q = hull.geometry.attributes.position
        const v = new T.Vector3()
        const bag = { spine: [0, 0], flank: [0, 0], belly: [0, 0], root: [0, 0] }
        for (let i = 0; i < q.count; i++) {
          v.fromBufferAttribute(q, i).applyMatrix4(hull.matrix)
          const L = 0.2126 * c.getX(i) + 0.7152 * c.getY(i) + 0.0722 * c.getZ(i)
          const ax = Math.abs(v.x)
          let k = null
          if (ax < 0.07 && v.y > 0.62) k = 'spine'
          else if (ax > 0.24 && v.y > 0.38 && v.y < 0.58) k = 'flank'
          else if (v.y < 0.24 && ax < 0.14) k = 'belly'
          else if (v.y < 0.34 && ax > 0.12 && ax < 0.24 &&
                   Math.abs(Math.abs(v.z) - 0.28) < 0.08) k = 'root'
          if (k) { bag[k][0] += L; bag[k][1]++ }
        }
        res.coat = {}
        for (const k in bag) res.coat[k] = bag[k][1]
          ? Math.round(bag[k][0] / bag[k][1] * 1000) / 1000 : null
        res.coat.spineOverFlank = res.coat.spine && res.coat.flank
          ? Math.round(res.coat.spine / res.coat.flank * 1000) / 1000 : null
        res.coat.rootOverFlank = res.coat.root && res.coat.flank
          ? Math.round(res.coat.root / res.coat.flank * 1000) / 1000 : null
      }

      res.progs = g.renderer.info.programs ? g.renderer.info.programs.length : null
      res.lastError = g.state && g.state.lastError ? String(g.state.lastError) : null
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })
  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R2-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
