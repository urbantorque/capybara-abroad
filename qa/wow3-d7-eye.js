async page => {
  // ROADMAP-WOW3 D7 — the six landing spots, seen through the game's OWN
  // camera rig rather than an ad-hoc placed one (an earlier attempt at a
  // manually-placed THREE.PerspectiveCamera kept landing inside geometry —
  // not worth debugging further when the game's own follow-cam, tuned and
  // collision-aware for every chapter already, does the job for free): for
  // each kind, cross into its own `from` chapter, teleport the animal a few
  // metres short of compHOME[kind] so it is looking AT the spot rather than
  // standing on it, let the camera settle, screenshot.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(1500)

  // { kind, biome, home: {x,z}, stand: {x,z} — a few metres back so the lens
  // looks AT the spot instead of standing on top of it }
  const SPOTS = [
    { kind: 'pigeon',      biome: 'venice',    home: { x: 12, z: -17 }, stand: { x: 12, z: -10 } },
    { kind: 'cat',         biome: 'goreme',    home: { x: 0,  z: 34 },  stand: { x: 0,  z: 27 } },
    { kind: 'silver gull', biome: 'manly',     home: { x: -13.5, z: 47.0 }, stand: { x: -13.5, z: 40 } },
    { kind: 'gentoo',      biome: 'antarctic', home: { x: 24, z: 92 },  stand: { x: 24, z: 85 } },
    { kind: 'heron',       biome: 'kyoto',     home: { x: 48, z: -6 },  stand: { x: 48, z: -13 } },
    { kind: 'ibis',        biome: 'sydney',    home: { x: -10.0, z: 12.6 }, stand: { x: -10.0, z: 19 } },
  ]
  const out = { errs, rows: [] }
  for (const s of SPOTS) {
    const here = await page.evaluate(() => window.__capy.biome.current)
    if (here !== s.biome) {
      await page.evaluate((n) => window.__capy.hud.cross(n), s.biome)
      await page.waitForFunction((n) => window.__capy.biome.current === n, s.biome, { timeout: 60000, polling: 300 })
      await page.waitForTimeout(4500)
    }
    await page.evaluate((sp) => {
      const g = window.__capy
      const y = (g.biome && g[g.biome.current] && g[g.biome.current].terrainHeight)
        ? g[g.biome.current].terrainHeight(sp.stand.x, sp.stand.z) : 1.2
      g.capy.body.position.set(sp.stand.x, y + 1.2, sp.stand.z)
      g.capy.body.velocity.setZero()
    }, s)
    for (let tries = 0; tries < 12; tries++) {
      const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      await page.waitForTimeout(700)
      const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
    }
    await page.screenshot({ path: 'qa/wow3-d7-eye-' + s.kind.replace(/\s+/g, '') + '.png' })
    out.rows.push({ kind: s.kind, biome: s.biome, home: s.home, stand: s.stand })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow3-d7-eye.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
