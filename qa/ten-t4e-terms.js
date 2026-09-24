async page => {
  // T4e: WHICH TERM IS THE MURK. Same pinned reef lens as ten-t4e-clear.js,
  // world clock frozen, one frame per arm with a single term knocked out
  // after palawan.js's own draw hook: the fog pushed to 2 km, the composite's
  // water tint off, the depth terms off (noDepth), the sub light (hemi) left
  // alone. Frame-mean L and chroma of the middle third per arm, and PNGs.
  // Run in the session ten-t4e-clear.js left in Palawan (it re-enters).
  const NAME = 'ten-t4e-terms'
  const PORT = 5195
  const out = { arms: {} }
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('palawan') })
  let t0 = Date.now()
  while (Date.now() - t0 < 40000) {
    const ok = await page.evaluate(() => { const g = window.__capy; return g.biome.current === 'palawan' && !!g.palawan && g.capy.position.z > 20 })
    if (ok) break
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(7000)
  await page.evaluate(() => {
    const g = window.__capy
    g.state.noLensCap = true
    const orig = g.post.render
    g.post.render = function () {
      const c = g.camera, p = g.palawan
      c.position.set(-13, Math.min(-1.2, p.camFloor(-13, 2) - 0.95 + 1.4), 2)
      c.lookAt(-13, p.camFloor(-13, -8) - 0.15, -8)
      c.updateMatrixWorld()
      const A = window.__t4eArm || ''
      if (A === 'nosub') { g.post.params.sub = 0 }
      return orig.apply(this, arguments)
    }
    const prev = g.scene.onBeforeRender
    g.scene.onBeforeRender = function (r, s, cam, t) {
      prev.call(this, r, s, cam, t)
      const A = window.__t4eArm || ''
      if (A === 'nofog') { s.fog.near = 1500; s.fog.far = 2000 }
      if (A === 'nosub') { g.post.params.sub = 0 }
    }
  })
  await page.waitForTimeout(4000)
  await page.evaluate(() => { const g = window.__capy; window.__t4eStep = g.time.step; g.time.step = () => 0 })
  const lab = `
    function lin(u) { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4) }
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116 }
    function toLab(r, g, b) {
      const R = lin(r), G = lin(g), B = lin(b)
      const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
      const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
      const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
      const fx = f(X), fy = f(Y), fz = f(Z)
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
    }`
  const arms = [['clear', {}], ['row', { noPalClear: true }], ['nofog', {}], ['nosub', {}], ['nodepth', { noDepth: true }], ['noshade', { noShade: true }]]
  for (const [nm, flags] of arms) {
    await page.evaluate(o => { const g = window.__capy; g.state.noPalClear = !!o.f.noPalClear; g.state.noDepth = !!o.f.noDepth; g.state.noShade = !!o.f.noShade; window.__t4eArm = o.nm }, { nm, f: flags })
    await page.waitForTimeout(500)
    const b64 = (await page.screenshot({ path: 'qa/' + NAME + '-' + nm + '.png' })).toString('base64')
    out.arms[nm] = await page.evaluate(async o => {
      eval(o.lab)
      const im = new Image(); im.src = 'data:image/png;base64,' + o.b64; await im.decode()
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
      const x = c.getContext('2d'); x.drawImage(im, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height
      let L = 0, C = 0, n = 0, Lt = 0, nt = 0, Lb = 0, nb = 0
      for (let y = Math.floor(H / 3); y < Math.floor(H * 2 / 3); y += 2) for (let xx = Math.floor(W / 3); xx < Math.floor(W * 2 / 3); xx += 2) {
        const i = (y * W + xx) * 4, l = toLab(d[i], d[i + 1], d[i + 2]); L += l[0]; C += Math.hypot(l[1], l[2]); n++
      }
      // the far band (the drop-off wall, 20-30 m) against the near seabed
      for (let xx = 400; xx < 880; xx += 3) { let i = (230 * W + xx) * 4, l = toLab(d[i], d[i + 1], d[i + 2]); Lt += l[0]; nt++; i = (700 * W + xx) * 4; l = toLab(d[i], d[i + 1], d[i + 2]); Lb += l[0]; nb++ }
      return { L: +(L / n).toFixed(1), C: +(C / n).toFixed(1), farL: +(Lt / nt).toFixed(1), nearL: +(Lb / nb).toFixed(1) }
    }, { b64, lab })
  }
  await page.evaluate(() => { const g = window.__capy; g.time.step = window.__t4eStep; g.state.noDepth = false; g.state.noShade = false; g.state.noPalClear = false; window.__t4eArm = '' })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
