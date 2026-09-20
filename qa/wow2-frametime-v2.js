async page => {
  // ROADMAP-WOW2 V2 — the interleaved rAF A/B for the people pass, the
  // wow-frametime.js pattern with this wave's flags and chapters. The
  // harness is headless (software GL) so the ABSOLUTE numbers are not a
  // reference machine's 16.7; the DELTA between the arms is what this reads.
  // The governor is pinned to 'pretty' so rung 0 is held throughout (the
  // terms park at rung >= 1, which would make the cut arm free for the
  // wrong reason).
  const FL = ['noGesture', 'noUmbrella', 'noCompany']
  const NAMES = ['sahara', 'rio', 'kyoto', 'hanoi', 'iceland']
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  const out = { errs, flags: FL, rows: {} }
  for (let ci = 0; ci < NAMES.length; ci++) {
    const name = NAMES[ci]
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    const r = await page.evaluate(async (FL) => {
      const g = window.__capy
      const frames = (n) => new Promise(res => { const t = []; let last = performance.now(); let k = 0
        const step = () => { const now = performance.now(); t.push(now - last); last = now; if (++k < n) requestAnimationFrame(step); else res(t) }
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
      const a = g.peopleAudit
      return { biome: g.biome.current, onMed: +med(on).toFixed(2), onP95: +p95(on).toFixed(2),
               offMed: +med(off).toFixed(2), offP95: +p95(off).toFixed(2),
               deltaMed: +(med(on) - med(off)).toFixed(2), rung: g.state.perfRung,
               gait: a.gait().by, gestStarted: a.gesture().started, umb: a.umbrella().roster.up + a.umbrella().locals.up,
               calls: g.state.perf && g.state.perf.calls }
    }, FL)
    out.rows[name] = r
  }
  // ---- ...and one flag at a time, where the three-flag sweep said the most.
  // noUmbrella cuts the LOCALS' umbrellas too, which are fourteen shadow-
  // casting meshes that have been in Kyoto since the presence pass — so a
  // three-flag arm charges this wave for something it did not add. Per flag
  // is the only honest attribution.
  out.perFlag = {}
  for (const name of ['kyoto', 'iceland']) {
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    out.perFlag[name] = await page.evaluate(async (FL) => {
      const g = window.__capy
      const frames = (n) => new Promise(res => { const t = []; let last = performance.now(); let k = 0
        const step = () => { const now = performance.now(); t.push(now - last); last = now; if (++k < n) requestAnimationFrame(step); else res(t) }
        requestAnimationFrame(step) })
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
      const arms = { live: [] }
      for (const f of FL) arms[f] = []
      for (let rep = 0; rep < 4; rep++) {
        for (const f of FL) g.state[f] = false
        await frames(8); arms.live.push(...await frames(50))
        for (const f of FL) {
          g.state[f] = true
          await frames(8); arms[f].push(...await frames(50))
          g.state[f] = false
        }
      }
      const o = { liveMed: +med(arms.live).toFixed(2) }
      for (const f of FL) o[f] = { med: +med(arms[f]).toFixed(2), delta: +(med(arms.live) - med(arms[f])).toFixed(2) }
      return o
    }, FL)
  }
  // ---- ...AND THE SIM COST ON ITS OWN, which is the number this wave can
  // actually be held to. Headless software GL is so noisy that a whole-frame
  // rAF median moves a millisecond and a half between two arms of a flag
  // that gates one probe every 1.5 s (noCompany, measured above at +1.5 ms
  // in Kyoto and -0.7 in Iceland — both impossible). game.tick(dt, false)
  // runs the same systems with no render, interleaved per BLOCK, so what is
  // left is the JS these terms add. The draw side is one instanced mesh per
  // rig, stated in the commit and visible in state.perf.calls.
  out.tick = {}
  for (const name of ['kyoto', 'sydney', 'iceland']) {
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    out.tick[name] = await page.evaluate((FL) => {
      const g = window.__capy
      const block = () => { const t0 = performance.now(); for (let i = 0; i < 120; i++) g.tick(1 / 60, false); return (performance.now() - t0) / 120 }
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
      const on = [], off = []
      for (let rep = 0; rep < 12; rep++) {
        for (const f of FL) g.state[f] = false
        block(); on.push(block())
        for (const f of FL) g.state[f] = true
        block(); off.push(block())
      }
      for (const f of FL) g.state[f] = false
      return { biome: g.biome.current, liveMsPerTick: +med(on).toFixed(3), cutMsPerTick: +med(off).toFixed(3),
               deltaMsPerTick: +(med(on) - med(off)).toFixed(3), blocks: on.length }
    }, FL)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-frametime-v2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
