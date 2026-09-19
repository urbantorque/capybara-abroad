// ROADMAP-WOW G3 — THE GROUND MIST. Per chapter in MIST_CHAPTERS: a fresh
// boot (trap 31: the arrival lens depends on where you came from), Begin via
// the button (trap 40), a real arrival via `hud.cross` (trap 36), a 9.5 s
// settle plus a camera-still poll, then the roadmap's own instrument: one
// composite frame with the band on, `state.noMist = true`, one frame off, and
// a per-pixel diff over the LOWER THIRD of the frame (the band's own screen
// region — a frame mean would dilute it by the two thirds of sky and wall it
// never touches). Both frames land as PNGs to be read by eye, which is the
// verdict; the number is the cross-check.
//
// Then one rain chapter forced on (`odds: 1, hold: 14` — trap 35: the
// envelope's rise is 0.22 of the hold, so a long hold is a slow attack) and
// the band's alpha/height sampled through the shower to show it rises.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const MIST_CHAPTERS = ['iceland', 'goreme', 'pantanal', 'drift', 'monaco', 'venice']
  const out = { errs, chapters: {}, shower: null }

  async function boot(name) {
    // Pretty pinned (pf: 1 -> rung 0): the band parks at rung 1 like the far
    // cascade, and a headless machine under six boots sits at rung 3 on auto.
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.evaluate(() => document.querySelector('.capyui-go').click())
    await page.waitForTimeout(1500)
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    for (let tries = 0; tries < 20; tries++) {
      const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      await page.waitForTimeout(1000)
      const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
    }
  }

  for (const name of MIST_CHAPTERS) {
    await boot(name)
    out.chapters[name] = await page.evaluate(async (n) => {
      const g = window.__capy
      async function shoot(tag) {
        const d = g.renderer.domElement.toDataURL('image/png')
        await fetch('/shot?name=' + tag, { method: 'POST', body: d.split(',')[1] })
      }
      function grab() {
        const c = g.renderer.domElement
        const t = document.createElement('canvas')
        t.width = c.width; t.height = c.height
        t.getContext('2d').drawImage(c, 0, 0)
        return { d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height }
      }
      // Lower third only: rows from 2h/3 to h. Mean over CHANGED pixels of
      // the per-channel mean abs delta, and the share of the band changed.
      function diffLower(A, B) {
        const w = A.w, h = A.h, y0 = Math.floor(h * 2 / 3)
        let n = 0, s = 0, tot = 0, sAll = 0
        for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const d = (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) +
                     Math.abs(A.d[i + 2] - B.d[i + 2])) / 3
          tot++; sAll += d
          if (d > 2) { n++; s += d }
        }
        return { pct: +(100 * n / tot).toFixed(2), meanChanged: +(s / Math.max(n, 1)).toFixed(2),
                 meanAll: +(sAll / tot).toFixed(3) }
      }
      // ...and the whole frame, so a wash would be caught as well.
      function diffAll(A, B) {
        let n = 0, s = 0
        for (let i = 0; i < A.d.length; i += 4) {
          const d = (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) +
                     Math.abs(A.d[i + 2] - B.d[i + 2])) / 3
          if (d > 2) { n++; s += d }
        }
        return { pct: +(100 * n / (A.d.length / 4)).toFixed(2), meanChanged: +(s / Math.max(n, 1)).toFixed(2) }
      }
      g.state.noMist = false
      g.tick(1 / 60, true)
      const onA = g.weather.mistAudit()
      const A = grab(); await shoot('wow-mist-' + n + '-on')
      g.state.noMist = true
      g.tick(1 / 60, true)
      const offA = g.weather.mistAudit()
      const B = grab(); await shoot('wow-mist-' + n + '-off')
      g.state.noMist = false
      const cp = g.capy.position, cam = g.camera.position
      return { biome: g.biome.current, started: g.state.started,
               rung: g.state.perfRung, on: onA, off: offA,
               lower: diffLower(A, B), whole: diffAll(A, B),
               capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)],
               cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)],
               calls: g.state.perf && g.state.perf.calls }
    }, name)
  }

  // ---- the shower, on Iceland (a rain row with the biggest band) -----------
  await boot('iceland')
  await page.evaluate(() => {
    const g = window.__capy
    const row = g.weather.rowOf('iceland')
    g.weather.set('iceland', { rain: { odds: 1, peak: Math.max(row.rain.peak, 0.6), hold: 14, gap: 1 } })
    // ...and the front pinned ON the line (L7, F4: the crossing is the
    // shower's cause now; set() alone only pulls the front to halfway).
    g.hud.front(0)
    window.__m = []
    window.__mi = setInterval(() => {
      const a = g.weather.mistAudit()
      window.__m.push({ t: +g.state.time.toFixed(1), rainT: a.rainT, alpha: a.alpha, h: a.h })
    }, 250)
  })
  await page.waitForTimeout(6500)
  await page.evaluate(async () => {
    const g = window.__capy
    g.tick(1 / 60, true)
    const d = g.renderer.domElement.toDataURL('image/png')
    await fetch('/shot?name=wow-mist-iceland-shower', { method: 'POST', body: d.split(',')[1] })
  })
  await page.waitForTimeout(6000)
  out.shower = await page.evaluate(() => {
    clearInterval(window.__mi)
    const r = window.__m
    const pk = (f) => r.reduce((m, x) => Math.max(m, x[f]), 0)
    return { samples: r.length, base: r[0], peakRainT: pk('rainT'), peakAlpha: pk('alpha'), peakH: pk('h'),
             trace: r.filter((x, i) => i % 4 === 0) }
  })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow-mist.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
