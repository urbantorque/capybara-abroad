// ROADMAP-WOW Part B, Sydney — A JACARANDA PETAL DRIFT ON THE GUST ACROSS THE
// FORECOURT. One chapter, one run: the title-card key (`Digit1`) at boot, a
// settle, a camera-still poll. Then from the REAL arrival lens:
//   - the skitter field (game.weather.skitterAudit().mesh): every instance's
//     world position projected through the lens — the count INSIDE the frustum
//     is the row's own measure (> 40 at arrival);
//   - sampled every 250 ms for 12 s: in-frame count, how many are in the air,
//     the gust; the max flying count is the drift actually happening;
//   - the cut: game.state.noSkitter → the mesh goes invisible (checked);
//   - the composite frame (game.post.render(), same turn) for the eye, once
//     when the most petals are up.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1') // sydney (1)
  await page.waitForTimeout(9000)
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }
  const out = { errs, samples: [] }
  let bestFly = -1
  for (let s = 0; s < 48; s++) {
    const r = await page.evaluate(async (shoot) => {
      const g = window.__capy, T = g.THREE
      const a = g.weather.skitterAudit()
      const cam = g.camera; cam.updateMatrixWorld()
      const M = new T.Matrix4(), v = new T.Vector3()
      let inF = 0, inFly = 0
      for (let i = 0; i < a.n; i++) {
        a.mesh.getMatrixAt(i, M); v.setFromMatrixPosition(M)
        const y = v.y; v.project(cam)
        if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) { inF++; if (y > 0.03) inFly++ }
      }
      let shot = false
      if (shoot) { if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, cam); await fetch('/shot?name=wow-sydney-petals', { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') }); shot = true }
      return { biome: g.biome.current, kind: a.kind, n: a.n, visible: a.visible, flying: a.flying, inFrame: inF, inFrameFlying: inFly, gust: a.gust, cam: cam.position.toArray().map(x => +x.toFixed(1)), shot }
    }, false)
    out.samples.push(r)
    if (r.flying > bestFly) bestFly = r.flying
    await page.waitForTimeout(250)
  }
  // the frame, at a moment with petals up: wait for flying >= half the best seen
  for (let s = 0; s < 40; s++) {
    const f = await page.evaluate(() => window.__capy.weather.skitterAudit().flying)
    if (f >= Math.max(3, bestFly * 0.5)) break
    await page.waitForTimeout(150)
  }
  out.shot = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const a = g.weather.skitterAudit(); const cam = g.camera; cam.updateMatrixWorld()
    const M = new T.Matrix4(), v = new T.Vector3(); let inF = 0
    for (let i = 0; i < a.n; i++) { a.mesh.getMatrixAt(i, M); v.setFromMatrixPosition(M).project(cam); if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) inF++ }
    if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, cam)
    await fetch('/shot?name=wow-sydney-petals', { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') })
    return { flying: a.flying, inFrame: inF }
  })
  // the cut
  out.cut = await page.evaluate(async () => {
    const g = window.__capy
    g.state.noSkitter = true
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const off = g.weather.skitterAudit().visible
    g.state.noSkitter = false
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    return { visibleWhenCut: off, visibleAfter: g.weather.skitterAudit().visible }
  })
  const inF = out.samples.map(s => s.inFrame), fl = out.samples.map(s => s.flying)
  out.summary = { inFrameMin: Math.min(...inF), inFrameMax: Math.max(...inF), inFrameMean: +(inF.reduce((a, b) => a + b, 0) / inF.length).toFixed(1), flyingMax: Math.max(...fl), flyingMean: +(fl.reduce((a, b) => a + b, 0) / fl.length).toFixed(1), samplesFlying: fl.filter(x => x > 0).length + '/' + fl.length }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-sydney-petals.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
