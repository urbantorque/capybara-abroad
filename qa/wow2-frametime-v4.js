// ROADMAP-WOW2 V4 — the frame-time A/B for noSub2, WHILE DIVING (the flag is
// a no-op above water: every term it cuts is already zero there, so an A/B
// taken dry would just measure noise). One chapter per run — edit CHAPTER.
// Reuses qa/wow2-sub.js's water-finding and dive technique, then the
// interleaved rAF A/B qa/wow-frametime.js established.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const CHAPTER = 'venice'
  const out = { errs, chapter: CHAPTER }

  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
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
    await page.waitForTimeout(9000)
  } else {
    await page.waitForTimeout(9000)
  }

  out.spot = await page.evaluate((chap) => {
    const g = window.__capy
    const api = chap === 'sydney' ? g.env : g[chap]
    if (!api || typeof api.isOverWater !== 'function') return null
    let deepest = { d: 0, x: 0, z: 0 }
    for (let r = 5; r < 260; r += 3) {
      for (let t = 0; t < 32; t++) {
        const a = t / 32 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r
        if (!api.isOverWater(x, z)) continue
        const th = api.terrainHeight(x, z)
        if (th < deepest.d) deepest = { d: th, x, z }
        if (th < -3.5) {
          const b = g.capy.body
          b.position.set(x, 0.4, z); b.velocity.set(0, 0, 0)
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
          b.aabbNeedsUpdate = true
          return { x: +x.toFixed(1), z: +z.toFixed(1), t: +api.terrainHeight(x, z).toFixed(2) }
        }
      }
    }
    if (deepest.d < -0.6) {
      const b = g.capy.body
      b.position.set(deepest.x, 0.4, deepest.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      b.aabbNeedsUpdate = true
      return { x: +deepest.x.toFixed(1), z: +deepest.z.toFixed(1), t: +deepest.d.toFixed(2) }
    }
    return null
  }, CHAPTER)
  if (!out.spot) {
    out.err = 'no deep water found'
    await page.evaluate(o => fetch('/shot?name=wow2-frametime-v4-' + o.chapter + '.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
    return
  }
  await page.waitForTimeout(2500)
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(700)
  await page.keyboard.down('KeyW')
  let depth = 0
  for (let i = 0; i < 20 && depth < 1.0; i++) {
    await page.waitForTimeout(200)
    depth = await page.evaluate(() => window.__capy.capy.depth || 0)
  }
  await page.keyboard.up('KeyW')
  let sub = 0
  for (let i = 0; i < 24 && sub < 0.5; i++) {
    await page.waitForTimeout(250)
    sub = await page.evaluate(() => (window.__capy.post && window.__capy.post.params) ? window.__capy.post.params.sub : 0)
  }
  out.diveState = { depth: +depth.toFixed(2), sub: +sub.toFixed(3) }

  // ---- the interleaved rAF A/B, held submerged throughout -----------------
  out.result = await page.evaluate(async () => {
    const g = window.__capy
    const raf = () => new Promise(res => requestAnimationFrame(res))
    const med = a => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(3) }
    const arm = async (noSub2) => {
      g.state.noSub2 = noSub2
      await raf(); await raf()
      const t0 = performance.now()
      for (let k = 0; k < 24; k++) await raf()
      return (performance.now() - t0) / 24
    }
    const on = [], off = []
    for (let rep = 0; rep < 8; rep++) { on.push(await arm(false)); off.push(await arm(true)) }
    g.state.noSub2 = false
    await raf(); await raf()
    return {
      biome: g.biome && g.biome.current, rung: g.state.perfRung | 0,
      msLiveOn: med(on), msCutOff: med(off), deltaMs: +(med(on) - med(off)).toFixed(3),
      onAll: on.map(x => +x.toFixed(3)), offAll: off.map(x => +x.toFixed(3)),
      subAtEnd: g.post && g.post.params ? g.post.params.sub : -1,
      diveAudit: g.weather ? g.weather.diveAudit() : null,
    }
  })
  await page.keyboard.up('KeyE')
  out.err2 = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null)
  await page.evaluate(o => fetch('/shot?name=wow2-frametime-v4-' + o.chapter + '.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
