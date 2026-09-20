async page => {
  // ROADMAP-WOW2 V3 — the interleaved rAF A/B for the far plane: noFar live
  // vs cut, ONE chapter per run (the eight-chapter loop of wow-frametime.js
  // is past the four-minute wall on a loaded machine). The harness is
  // headless (software GL), so the ABSOLUTE numbers are not the reference
  // machine's 16.7; the DELTA between arms is what this reads, and it is
  // contaminated while other agents' sessions render (the tell is the OFF
  // arm moving off its own median between reps). Chapters: sydney, rio,
  // kowloon, hanoi, monaco, iceland, palawan, antarctic (+ any other with a
  // far layer). Output: qa/wow2-frametime-v3-<chapter>.json.
  const FL = ['noFar']
  const CHAPTER = '__CHAPTER__'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(1500)
  const here = await page.evaluate(() => window.__capy.biome.current)
  if (here !== CHAPTER) {
    await page.evaluate((n) => window.__capy.hud.cross(n), CHAPTER)
    await page.waitForFunction((n) => window.__capy.biome.current === n, CHAPTER, { timeout: 60000, polling: 500 })
    await page.waitForTimeout(6000)
  } else {
    await page.waitForTimeout(4000)
  }
  const out = { errs, chapter: CHAPTER, flags: FL }
  out.row = await page.evaluate(async (FL) => {
    const g = window.__capy
    const frames = (n) => new Promise(res => { const t = []; let last = performance.now(); let k = 0
      const step = () => { const now = performance.now(); t.push(now - last); last = now; if (++k < n) requestAnimationFrame(step); else res(t) }
      requestAnimationFrame(step) })
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
    const p95 = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] }
    const on = [], off = [], onReps = [], offReps = []
    for (let rep = 0; rep < 6; rep++) {
      for (const f of FL) g.state[f] = false
      await frames(8); const a = await frames(50); on.push(...a); onReps.push(+med(a).toFixed(2))
      for (const f of FL) g.state[f] = true
      await frames(8); const b = await frames(50); off.push(...b); offReps.push(+med(b).toFixed(2))
    }
    for (const f of FL) g.state[f] = false
    const far = g.far && g.far.audit ? g.far.audit() : null
    return { biome: g.biome.current, onMed: +med(on).toFixed(2), onP95: +p95(on).toFixed(2), offMed: +med(off).toFixed(2), offP95: +p95(off).toFixed(2),
             liveMinusCut: +(med(on) - med(off)).toFixed(2), onReps, offReps, rung: g.state.perfRung, far,
             calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }
  }, FL)
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-frametime-v3-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
