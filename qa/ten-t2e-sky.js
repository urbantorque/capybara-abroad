async page => {
  // T2e PROOF, behaviour and a hide-and-diff, at rung 0 (prefs pf 1 pins the governor).
  //  1. THE ZENITH (noSahZenith): the resting lens rendered twice in one task, live then cut,
  //     so the camera cannot move between them. The mask is every pixel the cap changed; the
  //     sky/sand number is Michelson contrast between the mean luminance of the frame's sky
  //     (the mask) and the sand (the bottom 25% of rows), before (cut) and after (live).
  //  2. THE BEAMS (noSahRingBeam): a lens pinned 150 m south-west of ring 2, drawn with the
  //     plain renderer (the composite is not the question; the difference is), beam on/off.
  //  3. wowTarget and the beam levels through a run, by jetDebug.
  const CH = 'sahara', NAME = 'ten-t2e-sky'
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') out.errs.push(m.text().slice(0, 200)) })
  page.setDefaultNavigationTimeout(120000)
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5195/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(7000)
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  await page.waitForTimeout(4000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.rung = await page.evaluate(() => window.__capy.state.perfRung)
  out.audit0 = await page.evaluate(() => window.__capy.sahara.t2eAudit())
  await page.screenshot({ path: 'qa/' + NAME + '-rest-live.png' })

  // ---- 1. the zenith, hide-and-diff on the resting lens -------------------------------
  out.zen = await page.evaluate(() => {
    const g = window.__capy, st = g.state
    const grab = () => {
      g.tick(1 / 60, true)
      const c = g.renderer.domElement, t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return { w: t.width, h: t.height, d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data }
    }
    st.noSahZenith = false
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const kLive = g.sahara.t2eAudit().zen.k
    const A = grab()
    st.noSahZenith = true
    const B = grab()
    const kCut = g.sahara.t2eAudit().zen.k
    st.noSahZenith = false
    const L = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    let n = 0, sa = 0, sb = 0, rA = 0, gA = 0, bA = 0, rB = 0, gB = 0, bB = 0, maxD = 0, lowRow = 0
    let na = 0, sandA = 0, sandB = 0, sR = 0, sG = 0, sBl = 0
    const W = A.w, H = A.h
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
      // the top 35% of rows only: below that the crowd moves between the two frames
      if (dd > 6 && y < H * 0.35) {
        n++; sa += L(A.d, i); sb += L(B.d, i)
        rA += A.d[i]; gA += A.d[i + 1]; bA += A.d[i + 2]; rB += B.d[i]; gB += B.d[i + 1]; bB += B.d[i + 2]
        if (dd > maxD) maxD = dd
        if (y > lowRow) lowRow = y
      }
      if (y >= H * 0.75) { na++; sandA += L(A.d, i); sandB += L(B.d, i); sR += B.d[i]; sG += B.d[i + 1]; sBl += B.d[i + 2] }
    }
    const skyA = n ? sa / n : 0, skyB = n ? sb / n : 0, sA = sandA / na, sB = sandB / na
    const mich = (a, b) => Math.abs(a - b) / (a + b)
    return { kLive, kCut, w: W, h: H, maskFrac: +(n / (W * H)).toFixed(4), maskLowestRowFrac: +(lowRow / H).toFixed(3), maxDelta: maxD,
      skyLumBefore: +skyB.toFixed(4), skyLumAfter: +skyA.toFixed(4), sandLumBefore: +sB.toFixed(4), sandLumAfter: +sA.toFixed(4),
      skyRgbBefore: n ? [rB / n, gB / n, bB / n].map(v => Math.round(v)) : null, skyRgbAfter: n ? [rA / n, gA / n, bA / n].map(v => Math.round(v)) : null,
      contrastBefore: +mich(skyB, sB).toFixed(4), contrastAfter: +mich(skyA, sA).toFixed(4),
      // the colour distance, sky mean to sand mean, in 8-bit RGB: the blue is mostly a hue break
      sandRgb: [sR / na, sG / na, sBl / na].map(v => Math.round(v)),
      rgbDistBefore: n ? +Math.hypot(rB / n - sR / na, gB / n - sG / na, bB / n - sBl / na).toFixed(1) : 0,
      rgbDistAfter: n ? +Math.hypot(rA / n - sR / na, gA / n - sG / na, bA / n - sBl / na).toFixed(1) : 0 }
  })
  await page.evaluate(() => { window.__capy.state.noSahZenith = true })
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'qa/' + NAME + '-rest-cut.png' })
  await page.evaluate(() => { window.__capy.state.noSahZenith = false })

  // ---- 2. the beams from 150 m, pinned lens, plain render ----------------------------
  out.beam = await page.evaluate(() => {
    const g = window.__capy, st = g.state, T = g.THREE, cam = g.camera
    const rings = g.sahara.jet().rings
    const r = rings[1]
    const ang = Math.atan2(-1, -1)   // from the south-west
    const ex = r[0] + Math.cos(ang) * 150, ez = r[2] + Math.sin(ang) * 150
    const res = []
    const save = { p: cam.position.clone(), q: cam.quaternion.clone() }
    const grab = () => {
      cam.position.set(ex, 4, ez); cam.lookAt(r[0], r[1] + 8, r[2]); cam.updateMatrixWorld()
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      const c = g.renderer.domElement, t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return { t, d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height }
    }
    st.noSahRingBeam = false
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    const A = grab()
    const shotA = A.t.toDataURL('image/png')
    st.noSahRingBeam = true
    for (let i = 0; i < 2; i++) g.tick(1 / 60, false)
    const B = grab()
    st.noSahRingBeam = false
    cam.position.copy(save.p); cam.quaternion.copy(save.q)
    let n = 0, sd = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
      const i = (y * A.w + x) * 4
      const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
      if (dd > 12) { n++; sd += dd; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    // the ring's own column: pixels changed in the window round its projection
    const v = new T.Vector3(r[0], r[1] + 12, r[2]); cam.position.set(ex, 4, ez); cam.lookAt(r[0], r[1] + 8, r[2]); cam.updateMatrixWorld(); v.project(cam)
    const px = Math.round((v.x + 1) / 2 * A.w)
    let colN = 0
    for (let y = 0; y < A.h; y++) for (let x = px - 12; x <= px + 12; x++) {
      if (x < 0 || x >= A.w) continue
      const i = (y * A.w + x) * 4
      const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
      if (dd > 12) colN++
    }
    cam.position.copy(save.p); cam.quaternion.copy(save.q)
    return { dist: 150, ring: r, changed: n, meanDelta: n ? +(sd / n).toFixed(1) : 0, box: [x0, y0, x1, y1], ringColX: px, ringColChanged: colN, shotA }
  })
  const shotA = out.beam.shotA; delete out.beam.shotA
  await page.evaluate(o => fetch('/shot?name=' + o.name, { method: 'POST', body: o.b64 }), { name: NAME + '-beam150', b64: shotA.split(',')[1] })

  // ---- 3. wowTarget and the beam levels through a run --------------------------------
  out.run = await page.evaluate(() => {
    const g = window.__capy, s = g.sahara, rows = []
    const row = tag => { const a = s.t2eAudit(); rows.push({ tag, wt: s.wowTarget(), beam: a.beam.a, j: (({ on, run, next, done }) => ({ on, run, next, done }))(s.jet()) }) }
    row('before')
    s.jetDebug({ take: true })
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    row('taken')
    const rings = s.jet().rings
    for (let k = 0; k < rings.length; k++) {
      const r = rings[k]
      s.jetDebug({ x: r[0], y: r[1] - 0.6, z: r[2] })
      g.tick(1 / 60, false)
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      row('through ' + (k + 1))
    }
    return rows
  })
  // one picture from the air with the pack on: fly it up the course and look
  await page.evaluate(() => {
    const g = window.__capy, s = g.sahara
    s.jetDebug({ x: 250, y: 45, z: -60 })
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'qa/' + NAME + '-air.png' })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
