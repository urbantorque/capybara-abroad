async page => {
  // ROADMAP-WOW2 V3 — THE MOVER, COUNTED. ONE chapter per run. A fresh boot,
  // a real arrival, the lens left exactly where it rests, then a 120 s watch
  // in real time: once a second the far mover's position is projected through
  // the LIVE camera and a crossing is counted on the frame the projection
  // enters the frustum (NDC inside ±1 and in front, and the mover not hidden
  // for its gap). The bar is "crosses the arrival frame about once a
  // minute": ≥ 1 in 120 s, with the seconds in frame and the mover's path
  // reported so a miss can be read as a path that never enters the frame
  // rather than a mover that does not run. Also the layer's audit and the
  // rung (a mover parked at rung ≥ 1 is not a bug, it is the governor).
  // Output: qa/wow2-far-<chapter>.json. Console errors collected.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const CHAPTER = '__CHAPTER__'
  const WATCH = 120
  const out = { errs, chapter: CHAPTER, watchS: WATCH }

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

  let wasIn = false, crossings = 0, secondsIn = 0, seen = []
  for (let s = 0; s < WATCH; s++) {
    const r = await page.evaluate(() => {
      const g = window.__capy, T = g.THREE
      const f = g.far
      if (!f || !f.mover) return { none: true }
      const m = f.mover.mesh
      const p = m.getWorldPosition(new T.Vector3())
      const v = p.clone().project(g.camera)
      const inF = m.visible && v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z > -1 && v.z < 1
      return { at: [+p.x.toFixed(0), +p.y.toFixed(0), +p.z.toFixed(0)], ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], vis: m.visible, inF, rung: g.state.perfRung }
    })
    if (r.none) { out.none = true; break }
    if (r.inF) secondsIn++
    if (r.inF && !wasIn) { crossings++; seen.push({ s, at: r.at, ndc: r.ndc }) }
    wasIn = r.inF
    if (s % 10 === 0) seen.push({ s, at: r.at, ndc: r.ndc, vis: r.vis, inF: r.inF, rung: r.rung })
    await page.waitForTimeout(1000)
  }
  out.crossings = crossings
  out.secondsInFrame = secondsIn
  out.trace = seen
  out.audit = await page.evaluate(() => window.__capy.far && window.__capy.far.audit ? window.__capy.far.audit() : null)
  out.cam = await page.evaluate(() => { const g = window.__capy, T = g.THREE; const p = g.camera.getWorldPosition(new T.Vector3()), d = g.camera.getWorldDirection(new T.Vector3()); return { pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], dir: [+d.x.toFixed(2), +d.y.toFixed(2), +d.z.toFixed(2)] } })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-far-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
