async page => {
  // T4e: CLEAR WATER (noPalClear). Fresh free file, cross into Palawan, then
  // the lens is PINNED under the water (post.render wrapped: the camera is set
  // just before the draw, so palawan.js's lens test reads it the next frame and
  // palSub goes to 1 with the animal still on the beach). Two views:
  //  reef  — the coral garden 10 m off, level; the middle third of the frame.
  //  manta — 15 m off her (10.4, 10.4 in plan, 3.2 above), the lens riding her.
  // Per view the world clock is FROZEN (time.step -> 0) and five frames are
  // taken through the one lens: clear, row (noPalClear), clear again, target
  // hidden (clear), target hidden (row). The mask: hiding the target moved the
  // pixel and the repeat frame did not. Per arm: CIE Lab chroma of the target
  // (median, p75) and dE76 target-vs-hidden (how much it stands out of the
  // water). noLensCap is held on, so the capsule to the animal (on the beach)
  // cannot open anything in a pinned frame. qa/ten-t4e-clear.json + PNGs.
  const NAME = 'ten-t4e-clear'
  const PORT = 5195
  const out = { arms: {} }
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  out.started = await page.evaluate(() => !!window.__capy.state.started)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('palawan') })
  let t0 = Date.now()
  while (Date.now() - t0 < 40000) {
    const ok = await page.evaluate(() => { const g = window.__capy; return g.biome.current === 'palawan' && !!g.palawan && g.capy.position.z > 20 })
    if (ok) break
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(7000)   // the place card has to have gone
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(() => {
    const g = window.__capy
    g.state.noLensCap = true
    const orig = g.post.render
    window.__t4ePin = null
    g.post.render = function () {
      const P = window.__t4ePin
      if (P) {
        const c = g.camera
        if (P.manta) {
          const m = g.palawan.manta()
          c.position.set(m.x + P.dx, m.y + P.dy, m.z + P.dz)
          c.lookAt(m.x, m.y, m.z)
        } else {
          c.position.set(P.x, P.y, P.z)
          c.lookAt(P.lx, P.ly, P.lz)
        }
        c.updateMatrixWorld()
      }
      return orig.apply(this, arguments)
    }
  })
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
  const grab = async () => (await page.screenshot()).toString('base64')
  const analyse = (S, kind) => page.evaluate(async o => {
    eval(o.lab)
    const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data }
    const I = {}
    for (const k of ['a', 'a2', 'h', 'r', 'hr']) I[k] = await load(o.S[k])
    const W = 1280, H = 760
    const mid = o.kind === 'reef'
    const x0 = mid ? Math.floor(W / 3) : 0, x1 = mid ? Math.floor(W * 2 / 3) : W
    const y0 = mid ? Math.floor(H / 3) : 0, y1 = mid ? Math.floor(H * 2 / 3) : H
    const d3 = (P, Q, i) => Math.abs(P[i] - Q[i]) + Math.abs(P[i + 1] - Q[i + 1]) + Math.abs(P[i + 2] - Q[i + 2])
    const arm = { clear: { c: [], e: [], L: 0 }, row: { c: [], e: [], L: 0 } }
    let n = 0, noisy = 0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (x < 300 && y < 240) continue      // the paper
      if (x > 1060 && y > 540) continue     // the chart
      const i = (y * W + x) * 4
      if (d3(I.a, I.h, i) < 24) continue
      if (d3(I.a, I.a2, i) > 9) { noisy++; continue }
      n++
      for (const [nm, S, Hh] of [['clear', I.a, I.h], ['row', I.r, I.hr]]) {
        const la = toLab(S[i], S[i + 1], S[i + 2]), lb = toLab(Hh[i], Hh[i + 1], Hh[i + 2])
        arm[nm].c.push(Math.hypot(la[1], la[2]))
        arm[nm].e.push(Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]))
        // the target's colour against the water behind it, lightness left out:
        // a pink coral under a cyan cast has low chroma and a lot of this
        ;(arm[nm].ab = arm[nm].ab || []).push(Math.hypot(la[1] - lb[1], la[2] - lb[2]))
        arm[nm].L += la[0]
      }
    }
    const res = { maskPx: n, noisyPx: noisy }
    for (const nm of ['clear', 'row']) {
      const A = arm[nm]; A.c.sort((p, q) => p - q); A.e.sort((p, q) => p - q)
      const q = (v, fr) => v.length ? +v[Math.floor(v.length * fr)].toFixed(1) : null
      let fL = 0, fC = 0, fn = 0
      const S = nm === 'clear' ? I.a : I.r
      for (let i = 0; i < S.length; i += 4 * 37) { const l = toLab(S[i], S[i + 1], S[i + 2]); fL += l[0]; fC += Math.hypot(l[1], l[2]); fn++ }
      if (A.ab) A.ab.sort((p, r) => p - r)
      res[nm] = { chromaMed: q(A.c, 0.5), chromaP75: q(A.c, 0.75), dEMed: q(A.e, 0.5), dABMed: A.ab ? q(A.ab, 0.5) : null,
                  dEMean: A.e.length ? +(A.e.reduce((p, r) => p + r, 0) / A.e.length).toFixed(1) : null,
                  maskL: n ? +(A.L / n).toFixed(1) : null, frameL: +(fL / fn).toFixed(1), frameC: +(fC / fn).toFixed(1) }
    }
    return res
  }, { S, kind, lab })
  const read = () => page.evaluate(() => {
    const g = window.__capy, f = g.scene.fog, bg = g.scene.background, pp = g.post.params
    return { sub: +g.palawan.submerged().toFixed(3), clear: g.palawan.clearAudit ? g.palawan.clearAudit() : null,
             fogFar: +f.far.toFixed(1), fogNear: +f.near.toFixed(1),
             fog: '#' + f.color.getHexString(), bg: bg && bg.isColor ? '#' + bg.getHexString() : null,
             tint: [+(pp.subR || 0).toFixed(3), +(pp.subG || 0).toFixed(3), +(pp.subB || 0).toFixed(3), +(pp.sub || 0).toFixed(3)],
             cam: g.camera.position.toArray().map(v => +v.toFixed(2)), rung: g.state.perfRung, err: g.state.lastError || null }
  })
  const pinReef = await page.evaluate(() => {
    const g = window.__capy, p = g.palawan
    const cx = -13, cz = 2, lz = -8
    const fy = p.camFloor(cx, cz) - 0.95, ly = p.camFloor(cx, lz) - 0.95
    const P = { x: cx, y: Math.min(-1.2, fy + 1.4), z: cz, lx: cx, ly: ly + 0.8, lz }
    return { P, floorCam: +fy.toFixed(2), floorLook: +ly.toFixed(2) }
  })
  out.pinReef = pinReef
  const views = [{ key: 'reef', obj: ['palReef'], pin: pinReef.P },
                 { key: 'manta', obj: ['palManta', 'palManta2'], pin: { manta: true, dx: 10.4, dy: 3.2, dz: 10.4 } }]
  for (const v of views) {
    const R = out.arms[v.key] = {}
    await page.evaluate(o => { const g = window.__capy; g.state.noPalClear = false; window.__t4ePin = o }, v.pin)
    await page.waitForTimeout(4000)
    await page.evaluate(() => { const g = window.__capy; window.__t4eStep = g.time.step; g.time.step = () => 0 })
    await page.waitForTimeout(600)
    R.clearState = await read()
    const a = await grab(); await page.screenshot({ path: 'qa/' + NAME + '-' + v.key + '-clear.png' })
    await page.evaluate(() => { window.__capy.state.noPalClear = true }); await page.waitForTimeout(400)
    R.rowState = await read()
    const r = await grab(); await page.screenshot({ path: 'qa/' + NAME + '-' + v.key + '-row.png' })
    await page.evaluate(() => { window.__capy.state.noPalClear = false }); await page.waitForTimeout(400)
    const a2 = await grab()
    await page.evaluate(o => { for (const nm of o) { const m = window.__capy.scene.getObjectByName(nm); if (m) m.visible = false } }, v.obj)
    await page.waitForTimeout(400)
    const h = await grab()
    await page.evaluate(() => { window.__capy.state.noPalClear = true }); await page.waitForTimeout(400)
    const hr = await grab()
    await page.evaluate(o => { const g = window.__capy; for (const nm of o) { const m = g.scene.getObjectByName(nm); if (m) m.visible = true } g.state.noPalClear = false; g.time.step = window.__t4eStep }, v.obj)
    R.m = await analyse({ a, a2, h, r, hr }, v.key)
  }
  await page.evaluate(() => { window.__t4ePin = null; window.__capy.state.noPalClear = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
