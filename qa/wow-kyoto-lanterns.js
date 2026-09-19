// ROADMAP-WOW Part B, Kyoto — LANTERN LIGHT POOLED ON WET STONE UNDER THE EAVES.
// One chapter, one run: `Digit4` at boot, a settle, a camera-still poll. Then,
// from the real arrival lens through the real composite:
//   - game.raysAudit(): the spill clusters the scan found, which are in frame,
//     how far (the Gion globes are forty instances at terrain + 3.5);
//   - LIVE composite (A); two frames later a second live (B) — the motion
//     control (rain, motes, the lanterns swinging at 20 Hz); then
//     game.state.noSpill = true, two frames, CUT composite (C); restored.
//   - per-pixel: `excess` = pixels A→C moved (> 6) that A→B did not — the
//     term alone; reported for the whole frame and for the lower half (the
//     lane's paving); mean lift on those pixels and its colour.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit4') // kyoto (4)
  await page.waitForTimeout(9000)
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }
  const out = { errs }
  out.result = await page.evaluate(async () => {
    const g = window.__capy
    const ra = g.raysAudit()
    const clusters = ra.clusters.map(c => ({ at: c.at, d: c.d, inFrame: c.inFrame, c: c.c, r: c.r })).sort((a, b) => a.d - b.d)
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, g.camera); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const two = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))
    g.state.noSpill = false; await two()
    const A = grab(); const aUrl = g.renderer.domElement.toDataURL('image/png')
    await two()
    const B = grab()
    g.state.noSpill = true; await two()
    const C = grab(); const cUrl = g.renderer.domElement.toDataURL('image/png')
    g.state.noSpill = false
    const st = () => ({ n: 0, motion: 0, cut: 0, excess: 0, exSum: 0, r: 0, gg: 0, b: 0 })
    const R = { frame: st(), lower: st() }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 4
      const dm = Math.max(Math.abs(A[j] - B[j]), Math.abs(A[j + 1] - B[j + 1]), Math.abs(A[j + 2] - B[j + 2]))
      const dc = Math.max(Math.abs(A[j] - C[j]), Math.abs(A[j + 1] - C[j + 1]), Math.abs(A[j + 2] - C[j + 2]))
      for (const r of (y >= H / 2 ? [R.frame, R.lower] : [R.frame])) {
        r.n++; if (dm > 6) r.motion++; if (dc > 6) r.cut++
        if (dc > 6 && dm <= 6) { r.excess++; r.exSum += dc; r.r += A[j] - C[j]; r.gg += A[j + 1] - C[j + 1]; r.b += A[j + 2] - C[j + 2] }
      }
    }
    const fin = r => ({ px: r.n, motionPct: +(100 * r.motion / r.n).toFixed(2), cutPct: +(100 * r.cut / r.n).toFixed(2), excessPx: r.excess, excessPct: +(100 * r.excess / r.n).toFixed(2), excessMean: r.excess ? +(r.exSum / r.excess).toFixed(1) : 0, liftRGB: r.excess ? [r.r / r.excess, r.gg / r.excess, r.b / r.excess].map(v => +v.toFixed(1)) : null })
    await fetch('/shot?name=wow-kyoto-lanterns-live', { method: 'POST', body: aUrl })
    await fetch('/shot?name=wow-kyoto-lanterns-cut', { method: 'POST', body: cUrl })
    return { biome: g.biome.current, cam: g.camera.position.toArray().map(v => +v.toFixed(1)), clusters: clusters.length, inFrame: clusters.filter(c => c.inFrame).length, nearest: clusters.slice(0, 6), frame: fin(R.frame), lower: fin(R.lower) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-kyoto-lanterns.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
