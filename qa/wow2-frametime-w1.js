async page => {
  // ROADMAP-WOW2 W1 — the interleaved rAF A/B for V1 and V6: noAlive,
  // noFootfall, noTracks, live vs cut, five chapters. qa/wow-frametime.js's
  // own pattern and its own caveat: the harness is headless (software GL),
  // so the ABSOLUTE numbers are not the reference machine's 16.7 — the
  // DELTA between the arms is what this reads. The governor is pinned to
  // rung 0 through the prefs file, because a headless GL settles at rung 3
  // on its own and every one of these terms is parked from rung 1.
  const FL = ['noAlive', 'noFootfall', 'noTracks']
  // ...AND A SHAM ARM, which is the only way to read a delta this small off a
  // software GL: the identical A/B on a flag nothing in src has ever heard
  // of. Whatever it measures is the floor, and a real delta means anything
  // only where it is bigger than that.
  const SHAM = ['noW1Sham']
  const NAMES = ['sydney', 'palawan', 'antarctic', 'kyoto', 'sahara']
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  const out = { errs, rows: {} }
  for (let ci = 0; ci < NAMES.length; ci++) {
    const name = NAMES[ci]
    if (ci > 0) { await page.evaluate((n) => window.__capy.hud.cross(n), name); await page.waitForTimeout(9500) }
    // WALKING, not standing: two of the three terms are written by the gait
    // and a standing animal measures the cost of a term nobody is paying.
    await page.evaluate(() => {
      const g = window.__capy, inp = g.input
      g.capy.wake(600)
      const from = { x: g.capy.position.x, z: g.capy.position.z }
      window.__w1walk = () => {
        const t = g.state.time
        const tx = from.x + Math.cos(t * 0.7) * 6, tz = from.z + Math.sin(t * 0.7) * 6
        const p = g.capy.position, dx = tx - p.x, dz = tz - p.z, m = Math.hypot(dx, dz) || 1
        const cy = inp.camYaw || 0
        inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
        inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
        inp.run = true
      }
    })
    const r = await page.evaluate(async (FL) => {
      const g = window.__capy
      const frames = (n) => new Promise(res => { const t = []; let last = performance.now(); let k = 0
        const step = () => { window.__w1walk(); const now = performance.now(); t.push(now - last); last = now; if (++k < n) requestAnimationFrame(step); else res(t) }
        requestAnimationFrame(step) })
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
      const p95 = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] }
      const on = [], off = []
      for (let rep = 0; rep < 5; rep++) {
        for (const f of FL) g.state[f] = false
        await frames(10); on.push(...await frames(60))
        for (const f of FL) g.state[f] = true
        await frames(10); off.push(...await frames(60))
      }
      for (const f of FL) g.state[f] = false
      g.input.x = 0; g.input.z = 0; g.input.run = false
      const a = g.capy.animAudit()
      return { biome: g.biome.current, onMed: +med(on).toFixed(2), onP95: +p95(on).toFixed(2),
               offMed: +med(off).toFixed(2), offP95: +p95(off).toFixed(2),
               delta: +(med(on) - med(off)).toFixed(3), rung: g.state.perfRung,
               tracks: a.tracks.live, bursts: g.weather.burstAudit().alive }
    }, FL)
    const sh = await page.evaluate(async (FL) => {
      const g = window.__capy
      const frames = (n) => new Promise(res => { const t = []; let last = performance.now(); let k = 0
        const step = () => { window.__w1walk(); const now = performance.now(); t.push(now - last); last = now; if (++k < n) requestAnimationFrame(step); else res(t) }
        requestAnimationFrame(step) })
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
      const on = [], off = []
      for (let rep = 0; rep < 5; rep++) {
        for (const f of FL) g.state[f] = false
        await frames(10); on.push(...await frames(60))
        for (const f of FL) g.state[f] = true
        await frames(10); off.push(...await frames(60))
      }
      for (const f of FL) g.state[f] = false
      g.input.x = 0; g.input.z = 0; g.input.run = false
      return +(med(on) - med(off)).toFixed(3)
    }, SHAM)
    r.shamDelta = sh
    out.rows[name] = r
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-frametime-w1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
