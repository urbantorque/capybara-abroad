async page => {
  // T2c, the aurora is the sky: noAuroraRamp, noAuroraFrame, noSteamSoft. Rung pinned to 0.
  // Twice on a fresh profile, live and then with noAuroraRamp and noSteamSoft set (the frame
  // live in both, so the two tick frames are one view; the frame's own A/B is 'before' against
  // 'tick'): the animal in the hot pool, the sky forced up, the call that ticks `aurora`, then
  // four more in time (the burst).
  // At the tick: where the eye went (bearing, height, look elevation, the animal's and the
  // hem's place in the frame). Then hide-and-diff through ONE frozen copy of the camera, raw
  // renders in one task (wow-still.js's method: nothing ticks between the grabs, no exposure
  // adapts): the steam's share of the frame, and the curtain's centre column from the hem up
  // to 20 % past the top — a ramp falls without a step; a flat band ends in one.
  const NAME = 'ten-t2c-aurora'
  const PORT = 5193
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push(String(e.message || e).slice(0, 200)))
  const measure = () => page.evaluate(() => {
    const g = window.__capy, p = g.capy.position, rig = g.iceland.t2cRig(), a = g.iceland.auroraAudit()
    const cam = g.camera.clone(); cam.updateMatrixWorld()
    const V = () => cam.position.clone()
    const dir = cam.getWorldDirection(V())
    const pr = (x, y, z) => { const v = V().set(x, y, z).project(cam); return [+v.x.toFixed(2), +v.y.toFixed(2)] }
    // the curtain nearest the lens's own bearing
    const look = Math.atan2(p.x - cam.position.x, p.z - cam.position.z)
    let ci = 0, bd = 9
    rig.ang.forEach((q, i) => { const d = Math.abs(Math.atan2(Math.sin(q - look), Math.cos(q - look))); if (d < bd) { bd = d; ci = i } })
    const ramp = !g.state.noAuroraRamp
    const hemM = ramp ? rig.ramps[ci] : rig.bands[ci * 2], topM = ramp ? rig.ramps[ci] : rig.bands[ci * 2 + 1]
    const vtx = (m, idx) => { const at = m.geometry.attributes.position; m.updateMatrixWorld(); return m.localToWorld(V().set(at.getX(idx), at.getY(idx), at.getZ(idx))) }
    const rows = hemM.geometry.parameters.heightSegments, segs = hemM.geometry.parameters.widthSegments, mid = segs >> 1
    const h = vtx(hemM, rows * (segs + 1) + mid).project(cam), t = vtx(topM, mid).project(cam)
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const hideGrab = ms => { const was = ms.map(m => m.visible); ms.forEach(m => { m.visible = false }); const d = grab(); ms.forEach((m, i) => { m.visible = was[i] }); return d }
    const all = grab()
    const noSteam = hideGrab([rig.steam])
    const noSky = hideGrab(rig.ramps.concat(rig.bands))
    const L = (d, k) => 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]
    let n = 0, ns = 0
    for (let k = 0; k < all.length; k += 4) { if (Math.abs(L(all, k) - L(noSteam, k)) > 6) n++; if (L(all, k) - L(noSky, k) > 6) ns++ }
    const sx = q => (q.x * 0.5 + 0.5) * W, sy = q => (0.5 - q.y * 0.5) * H
    const col = []
    const inFront = h.z < 1 && t.z < 1
    for (let i = 0; i <= 60 && inFront; i++) {
      const f = i / 50, x = Math.round(sx(h) + (sx(t) - sx(h)) * f), y = Math.round(sy(h) + (sy(t) - sy(h)) * f)
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) { col.push(null); continue }
      let v = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = ((y + dy) * W + x + dx) * 4; v += L(all, k) - L(noSky, k) }
      col.push(+(v / 9).toFixed(1))
    }
    // from the brightest sample (the hem; the samples under it are the sky below the
    // curtain) up: a rise is any step up of more than 3 levels, and maxFall is the largest
    // single fall between two neighbours — the hard line at a band's top edge
    const v = col.filter(q => q !== null)
    let pk = 0
    for (let i = 1; i < v.length; i++) if (v[i] > v[pk]) pk = i
    let rises = 0, maxRise = 0, maxFall = 0
    for (let i = pk + 1; i < v.length; i++) { const d = v[i] - v[i - 1]; if (d > 3) rises++; if (d > maxRise) maxRise = d; if (-d > maxFall) maxFall = -d }
    return {
      t: +g.state.time.toFixed(1), rung: g.state.perfRung, fovDeg: cam.fov, audit: a,
      eye: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(2), +cam.position.z.toFixed(1)],
      animal: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
      bearing: +Math.atan2(cam.position.x - p.x, cam.position.z - p.z).toFixed(3),
      lookElevDeg: +(Math.asin(dir.y) * 180 / Math.PI).toFixed(1),
      animalNdc: pr(p.x, p.y + 0.4, p.z), curtain: ci, curtainAng: +rig.ang[ci].toFixed(3),
      hemNdc: inFront ? [+h.x.toFixed(2), +h.y.toFixed(2)] : null, topNdc: inFront ? [+t.x.toFixed(2), +t.y.toFixed(2)] : null,
      steam: { live: rig.live, drawn: rig.drawn, soft: rig.soft, framePct: +(100 * n / (W * H)).toFixed(2) },
      skyPct: +(100 * ns / (W * H)).toFixed(2),
      column: { rises, maxRise: +maxRise.toFixed(1), maxFall: +maxFall.toFixed(1), hem: v[0], top: v[v.length - 1], n: v.length, s: col.join(',') },
    }
  })
  for (const phase of ['live', 'off']) {
    const o = {}
    out[phase] = o
    await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'iceland') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('iceland') }); await page.waitForTimeout(11000)
    }
    await page.evaluate(ph => { const g = window.__capy; g.state.journeyMode = 'story'
      const off = ph === 'off'; g.state.noAuroraRamp = off; g.state.noAuroraFrame = false; g.state.noSteamSoft = off }, phase)
    o.biome = await page.evaluate(() => window.__capy.biome.current)
    await page.evaluate(() => { const g = window.__capy; const y = g.groundY(-40, -10); g.capy.body.position.set(-40, y + 0.8, -10); g.capy.body.velocity.set(0, 0, 0) })
    await page.waitForTimeout(3000)
    await page.evaluate(() => window.__capy.iceland.auroraForce(1)); await page.waitForTimeout(5000)
    o.before = await measure()
    await page.screenshot({ path: 'qa/' + NAME + '-' + phase + '-before.png' })
    o.call = await page.evaluate(() => window.__capy.iceland.auroraCall())
    await page.waitForTimeout(2200)
    o.tick = await measure()
    o.tickDone = await page.evaluate(() => window.__capy.taskDone('aurora'))
    await page.screenshot({ path: 'qa/' + NAME + '-' + phase + '-tick.png' })
    // four more in time from a fresh run: the fourth is the whole sky
    // (spaced in GAME time: a slow frame clamps dt, and wall-clock gaps came out under 0.9 s)
    for (let k = 0; k < 4; k++) {
      if (k) for (let w = 0; w < 40; w++) { await page.waitForTimeout(150); if (await page.evaluate(() => window.__capy.iceland.auroraAudit().since) >= 1.5) break }
      await page.evaluate(() => window.__capy.iceland.auroraCall())
    }
    await page.waitForTimeout(1300)
    o.burst = await measure()
    await page.screenshot({ path: 'qa/' + NAME + '-' + phase + '-burst.png' })
    o.err = await page.evaluate(() => window.__capy.state.lastError || null)
  }
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
