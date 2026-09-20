// ROADMAP-WOW2 V5 — THE SHOWER ENDS. One chapter per run (harness rule):
// edit CHAPTER and re-run for each. Forces a shower the trap-35 way (odds 1,
// hold 14 — the envelope's rise is 0.22 of the hold, so this SAMPLES the
// term across the whole hold rather than glancing at one frame, because a
// slow attack reads as zero for the first fifth) and watches it through to
// the tail where the rainbow and the puddles actually live (rainT falling
// back through 0.3, not the peak).
//
//   kyoto     the rainbow (uRainK via shared.js's rainbowInfo) and the
//             strip/drip (weather.burstAudit(), sampled with the animal
//             held still so a footfall's own dust cannot be counted as a
//             leaf) — this chapter carries all three.
//   kowloon   the puddle: the road's own material (userData.grainReflectWet)
//             found in the live scene, and a per-pixel diff of its own
//             screen footprint with noPuddle on and off at the wet peak.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  // EDIT THIS to the chapter under test.
  const CHAPTER = 'pantanal'
  const out = { errs, chapter: CHAPTER }

  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(1500)
  await page.evaluate((n) => window.__capy.hud.cross(n), CHAPTER)
  await page.waitForTimeout(9500)
  for (let tries = 0; tries < 20; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }

  // ---- force the shower, trap 35's way, and hold the animal still so a
  // footfall's own dust never lands in the strip/drip mote count -----------
  await page.evaluate(() => {
    const g = window.__capy
    const row = g.weather.rowOf(g.biome.current)
    g.weather.set(g.biome.current, { rain: { odds: 1, peak: Math.max(row.rain.peak, 0.65), hold: 14, gap: 999 } })
    g.hud.front(0)
    if (g.capy && g.capy.body) g.capy.body.velocity.set(0, 0, 0)
    window.__wow2 = []
    window.__wow2i = setInterval(() => {
      const b = g.weather.burstAudit ? g.weather.burstAudit() : null
      window.__wow2.push({ t: +g.state.time.toFixed(1), rainT: +g.weather.drizzle().toFixed(3),
                            cloud: +g.weather.cloud().toFixed(3), burstAlive: b ? b.alive : -1, burstBorn: b ? b.born : -1 })
    }, 250)
  })

  // sample through the peak (~3-6s) and well into the tail where rainT has
  // fallen back under 0.3 and the rainbow/puddle actually show (trap 35)
  await page.waitForTimeout(9000)
  const mid = await page.evaluate(async (n) => {
    const g = window.__capy
    const sh = await import('/src/shared.js')
    const d = g.renderer.domElement.toDataURL('image/png')
    await fetch('/shot?name=wow2-shower-' + n + '-tail', { method: 'POST', body: d.split(',')[1] })
    return { rainbow: sh.rainbowInfo(), rainT: +g.weather.drizzle().toFixed(3), cloud: +g.weather.cloud().toFixed(3) }
  }, CHAPTER)
  out.tail = mid

  // ---- THE RAINBOW: top-fifth per-pixel diff. uRainK toggled DIRECTLY
  // (rainbowTick, no g.tick between the two frames) — the same isolation
  // wow-dapple.js uses (dappleSet + a raw render, never the sim clock):
  // rain, gust and the clouds all keep moving on every g.tick regardless of
  // the flag, and the first cut of this instrument measured that motion —
  // 0.77% moved with the SAME shape whether or not rainT's own rainbow gate
  // was even open. Toggling the uniform in place with the clock held still
  // isolates the ring itself.
  out.rainbow = await page.evaluate(async (n) => {
    const g = window.__capy
    const sh = await import('/src/shared.js')
    const savedK = sh.rainbowInfo().k
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const render = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera) }
    sh.rainbowTick(savedK); render()
    const A = grab(); const onUrl = c2.toDataURL('image/png')
    sh.rainbowTick(0); render()
    const B = grab(); const offUrl = c2.toDataURL('image/png')
    sh.rainbowTick(savedK); render()
    await fetch('/shot?name=wow2-shower-' + n + '-rainbow-on', { method: 'POST', body: onUrl })
    await fetch('/shot?name=wow2-shower-' + n + '-rainbow-off', { method: 'POST', body: offUrl })
    const y1 = Math.floor(H * 0.2)   // top fifth
    let nD = 0, sD = 0, tot = 0
    for (let y = 0; y < y1; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3
      tot++; if (d > 2) { nD++; sD += d }
    }
    return { savedK: +savedK.toFixed(3), pct: +(100 * nD / tot).toFixed(2), meanChanged: +(sD / Math.max(nD, 1)).toFixed(2) }
  }, CHAPTER)

  // ---- THE PUDDLE (Kowloon only): the road's own screen footprint. Same
  // isolation as the rainbow above: puddleSet toggled directly, no g.tick
  // between the two frames, so the diff is the puddle term and nothing the
  // shower's own animation would have moved anyway. --------------------
  out.puddle = await page.evaluate(async (n) => {
    if (n !== 'kowloon') return { skipped: true }
    const g = window.__capy, T = g.THREE
    const sh = await import('/src/shared.js')
    function shown(o) { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    let road = null
    g.scene.traverse(o => { if (o.isMesh && shown(o) && o.material && o.material.userData && o.material.userData.grainReflectWet) road = o })
    if (!road) return { noRoad: true }
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const render = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera) }
    // mask: the road picked out by a colour key
    const key = new T.MeshBasicMaterial({ color: 0xff00ff, fog: false })
    const saved = road.material
    road.material = key
    render()
    const km = grab()
    road.material = saved
    const npx = W * H
    const mask = new Uint8Array(npx)
    let mN = 0
    for (let i = 0; i < npx; i++) { const j = i * 4; if (km[j] > 180 && km[j + 1] < 90 && km[j + 2] > 180) { mask[i] = 1; mN++ } }
    sh.puddleSet(1); render()
    const A = grab(); const onUrl = c2.toDataURL('image/png')
    sh.puddleSet(0); render()
    const B = grab(); const offUrl = c2.toDataURL('image/png')
    sh.puddleSet(1)
    await fetch('/shot?name=wow2-shower-kowloon-puddle-on', { method: 'POST', body: onUrl })
    await fetch('/shot?name=wow2-shower-kowloon-puddle-off', { method: 'POST', body: offUrl })
    let nD = 0, sD = 0
    for (let i = 0; i < npx; i++) {
      if (!mask[i]) continue
      const j = i * 4
      const d = (Math.abs(A[j] - B[j]) + Math.abs(A[j + 1] - B[j + 1]) + Math.abs(A[j + 2] - B[j + 2])) / 3
      if (d > 2) { nD++; sD += d }
    }
    return { maskPx: mN, movedPct: +(100 * nD / Math.max(mN, 1)).toFixed(2), meanMoved: +(sD / Math.max(nD, 1)).toFixed(2) }
  }, CHAPTER)

  // ---- THE STRIP/DRIP: let the trace run a while longer, then read it ----
  await page.waitForTimeout(6000)
  out.trace = await page.evaluate(() => {
    clearInterval(window.__wow2i)
    const r = window.__wow2 || []
    const peakBorn = r.length ? r[r.length - 1].burstBorn : -1
    return { samples: r.length, peakBorn, trace: r.filter((x, i) => i % 3 === 0) }
  })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow2-shower-' + o.chapter + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
