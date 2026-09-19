// ROADMAP-WOW A5 — THE BAND AND THE DISC. One chapter per run (harness rule,
// 19 Sep: a single run-code past ~4 minutes is killed). A fresh boot with
// pretty pinned (the term parks at rung 1 like the far cascade and the rays),
// Begin via the button (trap 40), a real arrival via `hud.cross` (trap 36), a
// settle plus a camera-still poll, then the roadmap's instrument in ONE
// evaluate with NO await between the arms (an await lets the page's rAF run
// the world on — wow-rays measured 21-35 % "floor" that way): a composite
// frame with the term on, a second on-frame (the noise floor), then
// `state.noSky2 = true` and one frame off. The per-pixel diff is taken over
// the TOP FIFTH of the frame (where the sky is), the 20-40 % band under it,
// and, as the control, the bottom 60 %, which must sit at the floor: a term on the dome paints
// nothing on the ground or on a building. Both frames land as PNGs and are
// read by eye; that reading is the verdict.
//
// Then the disc: the lens turned (rotation only — the dome rides the lens's
// POSITION, which does not move) to face the sun's axis and one post.render(),
// with the same on/off pair. The disc is at 41-61 degrees in the three
// daylight chapters and the walking lens tops out at +7, so this is the only
// frame in which it can be read at all; the audit says where it projects.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const CHAPTER = 'palawan'
  const out = { errs, chapter: CHAPTER }

  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(1500)
  await page.evaluate((n) => window.__capy.hud.cross(n), CHAPTER)
  await page.waitForTimeout(9500)
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }

  // ---- the instrument, at a yaw. yaw null = the arrival lens as it is;
  // otherwise the lens is turned by real key events (Z adds yaw, X subtracts,
  // 2.4 rad/s — keys[] is private to systems.js) and given half a second.
  async function measure(tag, yawK) {
    return page.evaluate(async (o) => {
    const g = window.__capy
    function turnTo(yaw) {
      let d = yaw - g.input.camYaw
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      const code = d > 0 ? 'KeyZ' : 'KeyX'
      const n = Math.ceil(Math.abs(d) / 2.4 * 60)
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'KeyZ' ? 'z' : 'x', bubbles: true }))
      for (let i = 0; i < n; i++) g.tick(1 / 60, false)
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code === 'KeyZ' ? 'z' : 'x', bubbles: true }))
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    }
    if (o.yaw !== null) turnTo(o.yaw)
    function grab() {
      const c = g.renderer.domElement
      const t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return { d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height }
    }
    // per-pixel diff in three masks: rows 0..h/5 (the sky fifth), h/5..0.4h
    // (the horizon band: sky in Sahara's 36 %, roofs elsewhere) and the bottom
    // 60 % — ground and people in all six, the control that must sit at floor
    function diff(A, B) {
      const w = A.w, h = A.h, cut = Math.floor(h / 5), cut2 = Math.floor(h * 0.4)
      let tn = 0, ts = 0, tpk = 0, mn = 0, ms = 0, mpk = 0, bn = 0, bs = 0, bpk = 0
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const d = (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])) / 3
        if (y < cut) { if (d > tpk) tpk = d; if (d > 2) { tn++; ts += d } }
        else if (y < cut2) { if (d > mpk) mpk = d; if (d > 2) { mn++; ms += d } }
        else { if (d > bpk) bpk = d; if (d > 2) { bn++; bs += d } }
      }
      return { topPct: +(100 * tn / (w * cut)).toFixed(2), topMean: +(ts / Math.max(tn, 1)).toFixed(2), topPeak: +tpk.toFixed(1),
               midPct: +(100 * mn / (w * (cut2 - cut))).toFixed(2), midMean: +(ms / Math.max(mn, 1)).toFixed(2),
               groundPct: +(100 * bn / (w * (h - cut2))).toFixed(2), groundMean: +(bs / Math.max(bn, 1)).toFixed(2), groundPeak: +bpk.toFixed(1) }
    }
    // the mean sRGB of the sky fifth, on, so the level can be read as a number too
    function skyMean(A) {
      const w = A.w, cut = Math.floor(A.h / 5)
      let r = 0, gg = 0, b = 0, n = 0
      for (let y = 0; y < cut; y += 2) for (let x = 0; x < w; x += 2) { const i = (y * w + x) * 4; r += A.d[i]; gg += A.d[i + 1]; b += A.d[i + 2]; n++ }
      return [Math.round(r / n), Math.round(gg / n), Math.round(b / n)]
    }
    g.state.noSky2 = false
    g.tick(0, true)               // the warm tick: the first frame after a pause moves
    g.tick(0, true)
    const audit = g.sky2Audit()
    const A = grab(); const urlOn = g.renderer.domElement.toDataURL('image/png')
    g.tick(0, true)
    const A2 = grab()             // the noise floor: two ON frames at dt = 0
    g.state.noSky2 = true
    g.tick(0, true)
    const B = grab(); const urlOff = g.renderer.domElement.toDataURL('image/png')
    const auditOff = g.sky2Audit()
    g.state.noSky2 = false
    g.tick(0, true)

    // ---- the disc: face the sun, one composite render, on and off ---------
    let disc = null, urlSunOn = null, urlSunOff = null
    if (audit.sun.k > 0.0005 || o.forceSun) {
      const cam = g.camera
      const q0 = cam.quaternion.clone()
      const s = audit.sun.dir
      const look = cam.position.clone(); look.x += s[0] * 100; look.y += s[1] * 100; look.z += s[2] * 100
      function face() { cam.quaternion.copy(q0); cam.lookAt(look); cam.updateMatrixWorld(true) }
      face(); g.post.render()
      const S1 = grab(); urlSunOn = g.renderer.domElement.toDataURL('image/png')
      face(); g.post.render()
      const S2 = grab()
      g.state.noSky2 = true
      g.tick(0, true)             // the cut lands through the tick (the camera comes back)
      face(); g.post.render()
      const S3 = grab(); urlSunOff = g.renderer.domElement.toDataURL('image/png')
      g.state.noSky2 = false
      cam.quaternion.copy(q0); cam.updateMatrixWorld(true)
      g.tick(0, true)
      // the disc frame is all sky: diff over the WHOLE frame, plus a centre disc of 0.12 frame heights
      function ddisc(P, Q) {
        const w = P.w, h = P.h, cx = w / 2, cy = h / 2
        let n = 0, s2 = 0, cn = 0, cs = 0, ct = 0, pk = 0
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const d = (Math.abs(P.d[i] - Q.d[i]) + Math.abs(P.d[i + 1] - Q.d[i + 1]) + Math.abs(P.d[i + 2] - Q.d[i + 2])) / 3
          if (d > pk) pk = d
          if (d > 2) { n++; s2 += d }
          if (Math.hypot(x - cx, y - cy) / h < 0.12) { ct++; if (d > 2) { cn++; cs += d } }
        }
        return { pct: +(100 * n / (w * h)).toFixed(2), mean: +(s2 / Math.max(n, 1)).toFixed(2), peak: +pk.toFixed(1),
                 centrePct: +(100 * cn / ct).toFixed(2), centreMean: +(cs / Math.max(cn, 1)).toFixed(2) }
      }
      const i0 = ((Math.floor(S1.h / 2)) * S1.w + Math.floor(S1.w / 2)) * 4
      disc = { onOff: ddisc(S2, S3), floor: ddisc(S1, S2), centreOn: [S1.d[i0], S1.d[i0 + 1], S1.d[i0 + 2]], centreOff: [S3.d[i0], S3.d[i0 + 1], S3.d[i0 + 2]] }
    }
    await fetch('/shot?name=wow-sky-' + o.tag + '-on', { method: 'POST', body: urlOn.split(',')[1] })
    await fetch('/shot?name=wow-sky-' + o.tag + '-off', { method: 'POST', body: urlOff.split(',')[1] })
    if (urlSunOn) await fetch('/shot?name=wow-sky-' + o.tag + '-sun-on', { method: 'POST', body: urlSunOn.split(',')[1] })
    if (urlSunOff) await fetch('/shot?name=wow-sky-' + o.tag + '-sun-off', { method: 'POST', body: urlSunOff.split(',')[1] })
    const cp = g.capy.position, cam2 = g.camera.position
    return { biome: g.biome.current, started: g.state.started, rung: g.state.perfRung,
             audit, auditOffK: auditOff.k, auditOffSun: auditOff.sun.k,
             diff: diff(A2, B), floor: diff(A, A2), skyMeanOn: skyMean(A2), skyMeanOff: skyMean(B), disc,
             capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)],
             cam: [+cam2.x.toFixed(2), +cam2.y.toFixed(2), +cam2.z.toFixed(2)], camYaw: +g.input.camYaw.toFixed(3),
             lastError: g.state.lastError || null }
    }, { tag, yaw: yawK, forceSun: false })
  }
  out.arrive = await measure(CHAPTER + '-arrive', null)
  // The arrival lens is not deterministic (Sahara: yaw 2.54 gave the plaza
  // and 36 % sky; yaw 1.49 a riad wall and 0 %). If the top fifth holds no
  // sky — the term changed under 3 % of it — turn 45 degrees and try again,
  // round the compass; the frame read is the one with sky in it.
  out.sweep = []
  if (out.arrive.diff.topPct < 3) {
    let yaw = out.arrive.camYaw
    for (let k = 0; k < 7 && out.arrive.diff.topPct < 3; k++) {
      yaw += Math.PI / 4
      out.arrive = await measure(CHAPTER + '-arrive', yaw)
      out.sweep.push({ yaw: out.arrive.camYaw, topPct: out.arrive.diff.topPct })
    }
  }

  // ---- the drift: two on-frames 20 s apart must differ in the sky fifth ----
  // (the term moves; a still one would be a painting)
  out.drift = await page.evaluate(async () => {
    const g = window.__capy
    function grab() {
      const c = g.renderer.domElement
      const t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return { d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height }
    }
    g.tick(0, true)
    const A = grab(); const o1 = g.sky2Audit().off
    for (let i = 0; i < 60 * 20; i++) g.tick(1 / 60, false)   // twenty seconds of world, no draw
    g.tick(0, true)
    const B = grab(); const o2 = g.sky2Audit().off
    const w = A.w, cut = Math.floor(A.h / 5)
    let n = 0
    for (let y = 0; y < cut; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if ((Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])) / 3 > 2) n++
    }
    return { topPctMoved: +(100 * n / (w * cut)).toFixed(2), offBefore: o1, offAfter: o2, gust: g.weather ? g.weather.gust() : null }
  })

  out.errs = errs
  return out
}
