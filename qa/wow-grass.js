// ROADMAP-WOW G1 — GRASS AS A VOLUME. ONE chapter per run (harness rule,
// 19 Sep: every run-code call under four minutes; the first attempt at this
// looped eight chapters in one call and died at the 600 s wall). A fresh
// boot with pretty pinned (trap 31/40), Begin via the button, a real arrival
// via hud.cross (trap 36: never switchTo), a settle plus a camera-still poll.
// Then three numbers and two pictures:
//   1. fans in frustum at arrival (instance origins projected, NDC box,
//      parked fans — zero-scale matrices — skipped)
//   2. the per-pixel diff noGrass on/off over the LOWER HALF of the frame,
//      both captures synchronous inside one evaluate through one frozen
//      camera, so nothing else moves between them
//   3. an interleaved rAF frame-time A/B, ten reps, grass on vs noGrass —
//      contaminated while other agents' sessions render (the tell is the
//      OFF arm moving off its historic 16.7)
// ...plus a screenshot with the grass on (read by eye — the bar is "a lawn
// the animal wades through, in the lawn's own green, nothing on paths, roads,
// sand or water"), a 0.6 s KeyW walk, and a second screenshot to read the
// trample behind the animal. Output: qa/wow-grass-<chapter>.json (+ two
// PNGs). Console errors are collected; 0 is the bar.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  // EDIT THIS to the chapter under test. One per run.
  const CHAPTER = 'pantanal'
  const out = { errs, chapter: CHAPTER }

  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  // The machine may be saturated by other agents' sessions (19 Sep: four open,
  // 100 % CPU, 5 s per module fetch), so every wait here is a poll, not a timer.
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
  for (let tries = 0; tries < 15; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }

  // ---- THE ARRIVAL MAY BE PAVING. Pasto lands on its plaza, Cali on a street:
  // where nothing stands at arrival (correctly), the body is put down on the
  // nearest ground the table says grows (b15-shots.js's move pattern), the
  // box relaid, and the same numbers taken there. The arrival count is kept.
  out.arrivalStanding = await page.evaluate(() => { const a = window.__capy.grass && window.__capy.grass.audit(); return a ? a.standing : -1 })
  out.arrivalUnderfoot = await page.evaluate(() => { const g = window.__capy, p = g.capy.position; return g.grass ? g.grass.probe(p.x, p.z) : null })
  if (out.arrivalStanding === 0 || !out.arrivalUnderfoot || out.arrivalUnderfoot.gate < 0.5) {
    out.moved = await page.evaluate(() => {
      const g = window.__capy, gr = g.grass, p = g.capy.position
      let best = null
      for (let r = 6; r <= 80 && !best; r += 2) for (let k = 0; k < 24 && !best; k++) {
        const a = k / 24 * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r
        const h = gr.probe(x, z)
        if (h && h.gate > 0.5) best = { x: +x.toFixed(2), y: h.y, z: +z.toFixed(2), r }
      }
      if (best) g.capy.body.position.set(best.x, best.y + 0.6, best.z)
      return best
    })
    await page.waitForTimeout(2500)
    for (let tries = 0; tries < 10; tries++) {
      const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      await page.waitForTimeout(800)
      const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
    }
  }

  out.result = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const gr = g.grass
    const audit = gr && gr.audit ? gr.audit() : null
    // ---- 1. fans in frustum -----------------------------------------------
    let inFrustum = 0, mesh = gr && gr.mesh
    if (mesh && mesh.count > 0) {
      const m = new T.Matrix4(), v = new T.Vector3()
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m)
        if (Math.abs(m.elements[0]) + Math.abs(m.elements[2]) < 0.01) continue   // parked: zero scale
        v.setFromMatrixPosition(m).project(g.camera)
        if (v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z > -1 && v.z < 1) inFrustum++
      }
    }
    // ---- 2. the per-pixel diff, lower half, one frozen camera -------------
    const cam = g.camera.clone(); cam.updateMatrixWorld()
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => {
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      ctx.drawImage(g.renderer.domElement, 0, 0)
      return ctx.getImageData(0, 0, W, H).data
    }
    const wasVisible = mesh ? mesh.visible : false
    const on = grab()
    if (mesh) mesh.visible = false
    const off = grab()
    if (mesh) mesh.visible = wasVisible
    let moved = 0, sum = 0
    const lowStart = Math.floor(H / 2), n = W * H
    for (let i = W * lowStart; i < n; i++) {
      const j = i * 4
      const d = Math.max(Math.abs(on[j] - off[j]), Math.abs(on[j + 1] - off[j + 1]), Math.abs(on[j + 2] - off[j + 2]))
      sum += d; if (d > 8) moved++
    }
    const diff = { movedLowerHalfPct: +(100 * moved / (n / 2)).toFixed(2), meanDiffLower: +(sum / (n / 2)).toFixed(3) }
    // ---- 3. interleaved rAF A/B, ten reps ---------------------------------
    const raf = () => new Promise(res => requestAnimationFrame(res))
    const arm = async (noGrass) => {
      g.state.noGrass = noGrass
      await raf(); await raf()
      const t0 = performance.now()
      for (let k = 0; k < 24; k++) await raf()
      return (performance.now() - t0) / 24
    }
    const A = [], B = []
    for (let rep = 0; rep < 10; rep++) { A.push(await arm(false)); B.push(await arm(true)) }
    g.state.noGrass = false
    await raf(); await raf()
    const med = a => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2) }
    // the ground read under the animal, and 3 m to each side
    const cp = g.capy.position
    const probes = gr && gr.probe ? [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].map(d => gr.probe(cp.x + d[0], cp.z + d[1])) : null
    return { biome: g.biome && g.biome.current, audit, inFrustum, count: mesh ? mesh.count : 0,
             diff, msOn: med(A), msOff: med(B), msOnAll: A.map(x => +x.toFixed(2)), msOffAll: B.map(x => +x.toFixed(2)),
             calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, probes,
             capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)] }
  })
  await page.screenshot({ path: `qa/wow-grass-${CHAPTER}.png` })
  // ---- the trample: walk 2 m and look behind ------------------------------
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(600)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(350)
  out.afterWalk = await page.evaluate(() => {
    const g = window.__capy, gr = g.grass
    const cp = g.capy.position
    return { audit: gr && gr.audit ? gr.audit() : null, capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)] }
  })
  await page.screenshot({ path: `qa/wow-grass-${CHAPTER}-walk.png` })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-grass-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
