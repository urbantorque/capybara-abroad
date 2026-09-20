async page => {
  // ROADMAP-WOW3 D6 — THE JACARANDA GUST, FORCED. Sydney only. Reuses the
  // trap-35 forcing pattern (a steady, unmodulated gust rather than a
  // sampled peak) and V5's own burst-audit trace shape (qa/wow2-shower.js):
  // teleport the animal beside a jacaranda (envJAC_SPOTS[6] = (6, 22.5),
  // well clear of the spawn lawn's own petal decals so a burst's own motes
  // are the only purple thing moving there), force row.gust to a constant
  // above its own peak*0.84 gate, and read moteQuad's own instance colour +
  // world position for every live burst slot across a several-second
  // window — the SAME mesh the fig gust (green) and this new jacaranda
  // gust (purple) both draw into, but never the one the ground-petal
  // skitter uses (a separate mesh, skitMesh, per wxAudit — so a slot found
  // here is never the skitter no matter its colour).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const out = { errs }

  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(1500)
  const here = await page.evaluate(() => window.__capy.biome.current)
  if (here !== 'sydney') {
    await page.evaluate(() => window.__capy.hud.cross('sydney'))
    await page.waitForFunction(() => window.__capy.biome.current === 'sydney', null, { timeout: 60000, polling: 500 })
    await page.waitForTimeout(6000)
  } else {
    await page.waitForTimeout(4000)
  }

  // ---- teleport beside the jacaranda at (6, 22.5) (envJAC_SPOTS[6]), and
  // force a steady gust well past the strip's own 0.84*peak gate ----------
  await page.evaluate(async () => {
    const g = window.__capy
    const y = g.biome && g[g.biome.current] && g[g.biome.current].terrainHeight
      ? g[g.biome.current].terrainHeight(6, 22.5) : 1.2
    g.capy.body.position.set(6, y + 1.2, 22.5)
    g.capy.body.velocity.setZero()
    g.weather.set('sydney', { gust: { base: 3.0, swing: 0, hz: 0.15 } })
    g.hud.front(0)
  })
  await page.waitForTimeout(2500)

  // ---- sample moteQuad's own instances every ~700 ms for ~7 s -----------
  out.samples = []
  for (let i = 0; i < 10; i++) {
    const s = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE
      const sh = await import('/src/shared.js')
      const purple = sh.PALETTE.petalPurple, green = sh.PALETTE.leafB
      const pc = new T.Color(purple), gc = new T.Color(green)
      const a = g.weather.burstAudit()
      const mesh = a.mesh
      const m = new T.Matrix4(), pos = new T.Vector3(), col = new T.Color()
      const rows = []
      for (let i = a.base; i < a.count; i++) {
        mesh.getMatrixAt(i, m)
        pos.setFromMatrixPosition(m)
        if (pos.y < -100) continue   // parked/dead slot
        if (mesh.instanceColor) mesh.getColorAt(i, col); else col.set(0xffffff)
        const dPurple = Math.hypot(col.r - pc.r, col.g - pc.g, col.b - pc.b)
        const dGreen = Math.hypot(col.r - gc.r, col.g - gc.g, col.b - gc.b)
        rows.push({ x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2),
                    isPurple: dPurple < 0.05, isGreen: dGreen < 0.05 })
      }
      return { t: +g.state.time.toFixed(1), born: a.born, alive: a.alive, rows }
    })
    out.samples.push(s)
    await page.waitForTimeout(700)
  }

  // ---- the honest tally: any purple slot within the jacaranda's own
  // radius (4.4 m of (6, 22.5)), airborne (y above the ~1.2 m ground) -----
  const jx = 6, jz = 22.5
  let purpleNear = 0, purpleAirborne = 0, greenSeen = 0, purpleMinY = 99, purpleMaxY = -99
  for (const s of out.samples) for (const r of s.rows) {
    if (r.isPurple) {
      const d = Math.hypot(r.x - jx, r.z - jz)
      if (d < 4.4) purpleNear++
      if (r.y > 1.6) purpleAirborne++
      purpleMinY = Math.min(purpleMinY, r.y); purpleMaxY = Math.max(purpleMaxY, r.y)
    }
    if (r.isGreen) greenSeen++
  }
  out.tally = { purpleNear, purpleAirborne, greenSeen, purpleMinY, purpleMaxY }

  await page.screenshot({ path: 'qa/wow3-d6-jacaranda-eye.png' })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow3-d6-jacaranda.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
