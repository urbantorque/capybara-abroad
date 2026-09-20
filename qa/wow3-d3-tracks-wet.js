async page => {
  // ROADMAP-WOW3 Part D item 3 — WET-ON-STONE, Venice at low tide. The gate
  // (capybara.js's capyFootfallFx): a hard material (stone/timber/gravel/
  // metal) within capyTRACK_WET_T (12 s) of leaving the water. Put the
  // animal IN the water first, tick until it is actually swimming (so
  // capySwimAgo starts counting from 0), then walk it straight up onto the
  // nearest paving and print through the SAME diff2/hide-and-look technique
  // qa/wow2-tracks.js used for sand and snow.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  await page.evaluate(() => window.__capy.hud.cross('venice'))
  await page.waitForTimeout(9500)
  const out = { errs }

  out.info = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const api = g.venice, p0 = g.capy.position
    const HARD = { stone: 1, timber: 1, gravel: 1, metal: 1 }
    // find a water point with a hard-material bank within a couple of
    // metres of it (so the walk-out is short and reliable)
    let best = null, bd = 1e9
    for (let dx = -60; dx <= 60; dx += 2) for (let dz = -60; dz <= 60; dz += 2) {
      const wx = p0.x + dx, wz = p0.z + dz
      if (!(api.isOverWater && api.isOverWater(wx, wz))) continue
      let bank = null
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const bx = wx + ux * 2.2, bz = wz + uz * 2.2
        if (api.isOverWater && api.isOverWater(bx, bz)) continue
        const by = api.terrainHeight ? api.terrainHeight(bx, bz) : 0
        api.surfacePitch(bx, bz, by + 0.34)
        if (HARD[api.surfaceMat()]) { bank = { x: bx, z: bz, y: by, dir: [ux, uz] }; break }
      }
      if (!bank) continue
      const d = dx * dx + dz * dz
      if (d < bd) { bd = d; best = { wx, wz, bank } }
    }
    if (!best) return { found: false }
    const b = g.capy.body
    b.position.set(best.wx, 0.3, best.wz); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.capy.wake(300)
    const inp = g.input
    inp.x = 0; inp.z = 0; inp.run = false
    let swam = 0
    for (let i = 0; i < 90; i++) {
      g.tick(1 / 60, false)
      if (g.capy.swimming) swam++
    }
    const from = { x: g.capy.position.x, z: g.capy.position.z }
    const target = best.bank
    let walked = 0
    for (let i = 0; i < 60 * 12; i++) {
      const p = g.capy.position
      const dx = target.x - p.x, dz = target.z - p.z, m = Math.hypot(dx, dz) || 1
      const cy = inp.camYaw || 0
      inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
      inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
      g.tick(1 / 60, false)
      walked = Math.hypot(p.x - from.x, p.z - from.z)
      if (m < 0.6) break
    }
    // a few more steps ONTO the paving, still inside the 12 s wet window
    for (let i = 0; i < 60; i++) { inp.x = target.dir[0] * 0.001; inp.z = target.dir[1]; g.tick(1 / 60, false) }
    inp.x = 0; inp.z = 0
    const aud = g.capy.animAudit()
    const ctr = aud.tracks.centre
    const cx0 = (ctr && ctr[0]) || target.x, cz0 = (ctr && ctr[1]) || target.z
    const my = api.terrainHeight ? api.terrainHeight(cx0, cz0) : target.y
    const cam = new T.PerspectiveCamera(42, 1280 / 760, 0.05, 400)
    cam.position.set(cx0 + 2.4, my + 3.4, cz0 + 2.4)
    cam.lookAt(cx0, my, cz0); cam.updateMatrixWorld()
    g.renderer.setRenderTarget(null)
    const capyGroup = g.capy.group, wasVis = capyGroup.visible
    capyGroup.visible = false
    g.renderer.render(g.scene, cam); g.renderer.render(g.scene, cam)
    window.__wetEye = g.renderer.domElement.toDataURL('image/png')
    capyGroup.visible = wasVis
    // ...and the diff2 mask, the same pinned camera, noTracks flipped
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    function diff() {
      const st = g.state
      st.noTracks = false; g.tick(1 / 60000, false)
      g.renderer.render(g.scene, cam); g.renderer.render(g.scene, cam)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      const A = ctx.getImageData(0, 0, W, H).data
      st.noTracks = true; g.tick(1 / 60000, false)
      g.renderer.render(g.scene, cam); g.renderer.render(g.scene, cam)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      const B = ctx.getImageData(0, 0, W, H).data
      st.noTracks = false; g.tick(1 / 60000, false)
      let px = 0
      const D = ctx.createImageData(W, H)
      for (let i = 0; i < W * H; i++) {
        const j = i * 4
        const d = Math.max(Math.abs(A[j] - B[j]), Math.abs(A[j + 1] - B[j + 1]), Math.abs(A[j + 2] - B[j + 2]))
        D.data[j + 3] = 255
        if (d > 8) { px++; D.data[j] = 255; D.data[j + 1] = 255; D.data[j + 2] = 255 }
      }
      ctx.putImageData(D, 0, 0)
      return { px, url: c2.toDataURL('image/png') }
    }
    const d1 = diff(), d2 = diff()
    const dBest = d1.px <= d2.px ? d1 : d2
    window.__wetDiff = dBest.url
    return { found: true, ctr: [cx0, cz0], live: aud.tracks.live, born: aud.tracks.born,
             swam, walked: +walked.toFixed(2), surfMat: aud.surfMat, swimAgo: +aud.swimAgo.toFixed(2),
             diffPx: dBest.px, target };
  })
  const eyeUrl = await page.evaluate(() => window.__wetEye)
  if (eyeUrl) await page.evaluate(async (u) => { await fetch('/shot?name=wow3-d3-wet-eye', { method: 'POST', body: u }) }, eyeUrl)
  const diffUrl = await page.evaluate(() => window.__wetDiff)
  if (diffUrl) await page.evaluate(async (u) => { await fetch('/shot?name=wow3-d3-wet-diff', { method: 'POST', body: u }) }, diffUrl)
  await page.evaluate(async (o) => { await fetch('/shot?name=wow3-d3-wet.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
