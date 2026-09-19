// ROADMAP-WOW A4 — THE RAYS. One chapter per run (harness rule, 19 Sep: a
// single run-code past ~4 minutes is killed). A fresh boot with pretty pinned
// (the term parks at rung 1 like the far cascade), Begin via the button (trap
// 40), a real arrival via `hud.cross` (trap 36), a settle plus a camera-still
// poll, then the roadmap's instrument in ONE evaluate: a composite frame with
// the rays on, `state.noRays = true`, one frame off, the per-pixel diff over
// the whole frame and over an annulus round the projected light (the term's
// own region — a frame mean dilutes it by everything it never touches). Both
// frames land as PNGs to be read by eye; that reading is the verdict.
//
// Then the off-frame test: the camera yawed until the source leaves the
// frame, and the same A/B — which must read ~0 % and raysLive 0.
//
// Then the rAF A/B, ten interleaved reps of 24 frames each. CONTAMINATED while
// other agents' browsers run on this machine (trap 33 / rules: quiet machine
// only); the tell is the OFF arm moving from 16.7. The honest instrument is
// post.render() x 40 with a readPixels drain at each end (capy3-the-lens #3),
// also reported.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const CHAPTER = 'kowloon'
  // Goreme's rays exist at the sun's event, not at arrival: wait for sunUp to
  // pass the ridge (gorSUN_P), polling at most this many seconds.
  const WAIT_EVENT_S = 0   // Goreme: the ridge event is balloon-altitude only (see sysRAYS); test the plaza's predawn arrival
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
  if (WAIT_EVENT_S > 0) {
    // jump the dawn to just past the ridge crossing (gorSUN_P 0.47), then poll
    out.eventWait = []
    await page.evaluate(() => { const g = window.__capy; if (g.goreme && g.goreme.setPhase) g.goreme.setPhase(0.545) })
    for (let t = 0; t < WAIT_EVENT_S; t += 2) {
      const s = await page.evaluate(() => {
        const g = window.__capy
        const up = g.goreme ? g.goreme.sunUp() : -1, sm = up * up * (3 - 2 * up)
        const v = g.camera.position.clone().set(760, -120 + 420 * sm, -70).project(g.camera)
        const c = g.camera.position.clone().set(760, -120 + 420 * sm, -70).applyMatrix4(g.camera.matrixWorldInverse)
        return { up: +up.toFixed(3), live: +(g.state.raysLive || 0).toFixed(3), ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)], camSpace: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], far: g.camera.far, camYaw: +g.input.camYaw.toFixed(3) }
      })
      out.eventWait.push(s)
      if (s.live > 0.05) break
      await page.waitForTimeout(2000)
    }
  }

  // ---- the instrument, at a yaw. yawK null = the arrival lens as it is;
  // otherwise input.camYaw is set and the damped camera given 1.5 s to land.
  async function measure(tag, yawK) {
    return page.evaluate(async (o) => {
      const g = window.__capy
      async function shoot(t) {
        const d = g.renderer.domElement.toDataURL('image/png')
        await fetch('/shot?name=' + t, { method: 'POST', body: d.split(',')[1] })
      }
      function grab() {
        const c = g.renderer.domElement
        const t = document.createElement('canvas')
        t.width = c.width; t.height = c.height
        t.getContext('2d').drawImage(c, 0, 0)
        return { d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height }
      }
      // whole frame, and an annulus 0.06..0.30 frame heights round the light
      function diff(A, B, lx, ly) {
        const w = A.w, h = A.h
        let n = 0, s = 0, an = 0, as = 0, at = 0, peak = 0
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const d = (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) +
                     Math.abs(A.d[i + 2] - B.d[i + 2])) / 3
          if (d > peak) peak = d
          if (d > 2) { n++; s += d }
          if (lx !== null) {
            const r = Math.hypot(x - lx, y - ly) / h
            if (r > 0.06 && r < 0.30) { at++; if (d > 2) { an++; as += d } }
          }
        }
        return { pct: +(100 * n / (w * h)).toFixed(2), meanChanged: +(s / Math.max(n, 1)).toFixed(2), peak: +peak.toFixed(1),
                 annulusPct: at ? +(100 * an / at).toFixed(2) : null, annulusMean: at ? +(as / Math.max(an, 1)).toFixed(2) : null }
      }
      // turn the lens by real key events (keys[] is private to systems.js):
      // Z adds yaw, X subtracts, 2.4 rad/s; then half a second for the damp.
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
      g.state.noRays = false
      g.tick(0, true)               // the warm tick: the first frame after a pause moves
      g.tick(0, true)
      const live = g.state.raysLive
      const pp = g.post.params
      const lx = live > 0 ? pp.raysX * g.renderer.domElement.width : null
      const ly = live > 0 ? (1 - pp.raysY) * g.renderer.domElement.height : null
      // NO AWAIT BETWEEN THE ARMS: a yield lets the page's own rAF loop run
      // the world on (measured 21-35 % on/on with a fetch between two dt = 0
      // frames). Grab all three synchronously; post the PNGs afterwards.
      const A = grab(); const urlOn = g.renderer.domElement.toDataURL('image/png')
      g.tick(0, true)
      const A2 = grab()             // the noise floor: two ON frames at dt = 0
      g.state.noRays = true
      g.tick(0, true)
      const B = grab(); const urlOff = g.renderer.domElement.toDataURL('image/png')
      g.state.noRays = false
      await fetch('/shot?name=wow-rays-' + o.tag + '-on', { method: 'POST', body: urlOn.split(',')[1] })
      await fetch('/shot?name=wow-rays-' + o.tag + '-off', { method: 'POST', body: urlOff.split(',')[1] })
      const cp = g.capy.position, cam = g.camera.position
      return { biome: g.biome.current, started: g.state.started, rung: g.state.perfRung,
               raysLive: +live.toFixed(3), light: lx === null ? null : [Math.round(lx), Math.round(ly)],
               row: { k: pp.rays, len: pp.raysLen, r: pp.raysR }, bloom: +pp.bloom.toFixed(3),
               diff: diff(A2, B, lx, ly), floor: diff(A, A2, lx, ly),
               capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)],
               cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)], camYaw: +g.input.camYaw.toFixed(3) }
    }, { tag, yaw: yawK })
  }
  out.arrive = await measure(CHAPTER + '-arrive', null)
  // ...and the sweep: eight yaws, raysLive at each, the A/B at the best one
  out.sweep = await page.evaluate(() => {
    const g = window.__capy
    const r = []
    for (let k = 0; k < 8; k++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', bubbles: true }))
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false)   // ~45 degrees
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'z', bubbles: true }))
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      g.tick(0, true)
      r.push({ yaw: +g.input.camYaw.toFixed(3), live: +(g.state.raysLive || 0).toFixed(3) })
    }
    return r
  })
  const best = out.sweep.reduce((m, x) => x.live > m.live ? x : m, out.sweep[0])
  const worst = out.sweep.find(x => x.live === 0) || null
  out.faced = best.live > 0 ? await measure(CHAPTER + '-faced', best.yaw) : null
  out.away = worst ? await measure(CHAPTER + '-away', worst.yaw) : null
  // let the lens come home before timing
  await page.waitForTimeout(2500)

  // ---- frame time: rAF A/B, interleaved, 10 reps ---------------------------
  out.raf = await page.evaluate(async () => {
    const g = window.__capy
    async function frames(nf) {
      return new Promise(res => {
        const ts = []
        let last = performance.now()
        function step() {
          const now = performance.now(); ts.push(now - last); last = now
          if (ts.length < nf) requestAnimationFrame(step); else res(ts)
        }
        requestAnimationFrame(step)
      })
    }
    const med = a => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2) }
    const on = [], off = []
    for (let r = 0; r < 10; r++) {
      g.state.noRays = false; await frames(4); on.push(med(await frames(24)))
      g.state.noRays = true;  await frames(4); off.push(med(await frames(24)))
    }
    g.state.noRays = false
    // ...and the honest one: post.render() x 40 with a readPixels drain
    const gl = g.renderer.getContext()
    const px = new Uint8Array(4)
    function timePost() {
      g.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const t0 = performance.now()
      for (let i = 0; i < 40; i++) g.post.render()
      g.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return (performance.now() - t0) / 40
    }
    const pOn = [], pOff = []
    for (let r = 0; r < 5; r++) {
      g.state.noRays = false; pOn.push(+timePost().toFixed(3))
      g.state.noRays = true;  pOff.push(+timePost().toFixed(3))
    }
    g.state.noRays = false
    return { rafOn: on, rafOff: off, rafOnMed: med(on), rafOffMed: med(off),
             postOn: pOn, postOff: pOff, postOnMed: med(pOn), postOffMed: med(pOff),
             raysLive: +(g.state.raysLive || 0).toFixed(3), lastError: g.state.lastError || null }
  })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow-rays.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
