// ROADMAP-WOW2 V4 — UNDER THE SURFACE. ONE chapter per run (harness rule):
// edit CHAPTER below and re-run for palawan, rio, kyoto, venice.
//
// Gets a REAL dive going (px-cam-dive.js's technique: capySwimming &&
// capyCanDive() && input.action wants a floating animal that presses E, not
// a held one) over water the biome itself says is deep (isOverWater &&
// terrainHeight < -4), holds E+W until capy.depth clears 1.4 m, then:
//   1/2. the ceiling + underwater rays: game.post.render() called TWICE,
//        synchronously, inside one evaluate, with only game.state.noSub2
//        toggled between them — no real time passes, so nothing but the
//        flag moves (the same trick qa/wow-grass.js uses on the raw scene;
//        this one goes through the composite instead, because that is
//        where these two terms live). Diffed over the UPPER THIRD.
//   3. the bubbles: game.weather.diveAudit() for the exact alive count
//      against the 48/s asked for (the pool's own numbers, same pattern as
//      burstAudit()), plus a per-pixel diff of the MOTE FIELD AS A WHOLE
//      (moteQuad.visible on/off) around the animal — this is NOT isolated to
//      bubbles alone (the chapter's own above-water row shares the mesh and
//      is not hidden by diving), and the report says so honestly.
//   4. the beads: forced via game.weather's own timer rather than waiting on
//      a real emerge (E released, W held to swim up) — read both ways.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  // EDIT THIS to the chapter under test. One per run.
  const CHAPTER = 'kyoto'
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
  out.rung = await page.evaluate(() => window.__capy.state.perfRung | 0)

  // ---- find deep water and drop in, exactly px-cam-dive.js's scan --------
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
          return { x: +x.toFixed(1), z: +z.toFixed(1), t: +api.terrainHeight(x, z).toFixed(2), fallback: false }
        }
      }
    }
    // fall back to the deepest point the sweep actually found, whatever it is
    if (deepest.d < -0.6) {
      const b = g.capy.body
      b.position.set(deepest.x, 0.4, deepest.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      b.aabbNeedsUpdate = true
      return { x: +deepest.x.toFixed(1), z: +deepest.z.toFixed(1), t: +deepest.d.toFixed(2), fallback: true }
    }
    return null
  }, CHAPTER)
  if (!out.spot) {
    out.err = 'no deep water found for ' + CHAPTER
    await page.evaluate(o => fetch('/shot?name=wow2-sub-' + o.chapter + '.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
    return
  }
  await page.waitForTimeout(2500)

  // ---- dive: hold E, then W, and poll depth until it clears 1.4 m --------
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(700)
  out.divingAfterE = await page.evaluate(() => !!window.__capy.capy.diving)
  await page.keyboard.down('KeyW')
  let depth = 0
  // A shallow, narrow canal (Venice, Kyoto) does not hold a forward-swimming
  // animal over deep water for long — it swims OUT of the pocket and
  // surfaces on its own in a couple of seconds. 1.0 m, then let go of W and
  // hover on E alone, is enough depth to matter and does not carry it away.
  for (let i = 0; i < 20 && depth < 1.0; i++) {
    await page.waitForTimeout(200)
    depth = await page.evaluate(() => window.__capy.capy.depth || 0)
  }
  await page.keyboard.up('KeyW')
  out.depthReached = +depth.toFixed(2)
  // The CAMERA is what subT actually reads (systems.js's dive rig pulls the
  // boom toward sysDIVE_LENS = 0.75 m under, on its own clock) — capy.depth
  // clearing 1.0 m says nothing about whether the LENS has followed it down
  // yet, so poll sub itself rather than assuming one follows the other.
  let sub = 0
  for (let i = 0; i < 24 && sub < 0.5; i++) {
    await page.waitForTimeout(250)
    sub = await page.evaluate(() => (window.__capy.post && window.__capy.post.params) ? window.__capy.post.params.sub : 0)
  }
  await page.keyboard.down('KeyW')
  out.subAt15 = await page.evaluate(() => {
    const g = window.__capy
    return { diving: !!g.capy.diving, depth: +(g.capy.depth || 0).toFixed(2),
             sub: +(g.post && g.post.params ? g.post.params.sub : -1).toFixed(3) }
  })

  // ---- 1/2. the ceiling + underwater rays: two synchronous post.render() -
  out.postDiff = await page.evaluate(() => {
    const g = window.__capy
    if (!g.post || !g.post.enabled) return { skipped: 'post disabled' }
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.post.render(); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const wasNoSub2 = !!g.state.noSub2
    g.state.noSub2 = false
    const on = grab()
    g.state.noSub2 = true
    const off = grab()
    g.state.noSub2 = wasNoSub2
    grab()   // leave the live picture on screen, not the cut one
    let movedUpper = 0, sumUpper = 0, movedAll = 0, sumAll = 0
    const upperEnd = Math.floor(H / 3), n = W * H
    for (let i = 0; i < n; i++) {
      const j = i * 4
      const d = Math.max(Math.abs(on[j] - off[j]), Math.abs(on[j + 1] - off[j + 1]), Math.abs(on[j + 2] - off[j + 2]))
      sumAll += d; if (d > 8) movedAll++
      const y = Math.floor(i / W)
      if (y < upperEnd) { sumUpper += d; if (d > 8) movedUpper++ }
    }
    return {
      upperThirdPct: +(100 * movedUpper / (W * upperEnd)).toFixed(2),
      upperThirdMean: +(sumUpper / (W * upperEnd)).toFixed(3),
      wholeFramePct: +(100 * movedAll / n).toFixed(2),
      wholeFrameMean: +(sumAll / n).toFixed(3),
    }
  })
  await page.screenshot({ path: `qa/wow2-sub-${CHAPTER}-on.png` })
  await page.evaluate(() => { window.__capy.state.noSub2 = true; window.__capy.post.render() })
  await page.screenshot({ path: `qa/wow2-sub-${CHAPTER}-off.png` })
  await page.evaluate(() => { window.__capy.state.noSub2 = false })

  // ---- 3. bubbles: the pool's own numbers, plus the mote-field mask ------
  out.diveAudit = await page.evaluate(() => window.__capy.weather ? window.__capy.weather.diveAudit() : null)
  await page.waitForTimeout(600)
  out.diveAudit2 = await page.evaluate(() => window.__capy.weather ? window.__capy.weather.diveAudit() : null)
  out.moteFieldDiff = await page.evaluate(() => {
    const g = window.__capy
    const cam = g.camera.clone(); cam.updateMatrixWorld()
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    // find the mote field: the InstancedMesh at renderOrder 6 with the most instances
    let mesh = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.renderOrder === 6 && (!mesh || o.count > mesh.count)) mesh = o })
    if (!mesh) return { skipped: 'no mote mesh found' }
    const was = mesh.visible
    mesh.visible = true; const on = grab()
    mesh.visible = false; const off = grab()
    mesh.visible = was; grab()
    // mask: around the animal's own screen projection, a generous 22% of frame height
    const v = g.capy.position.clone().project(cam)
    const cx = (v.x * 0.5 + 0.5) * W, cy = (1 - (v.y * 0.5 + 0.5)) * H
    const rad = H * 0.30
    let moved = 0, tot = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (Math.hypot(x - cx, y - cy) > rad) continue
      tot++
      const j = (y * W + x) * 4
      const d = Math.max(Math.abs(on[j] - off[j]), Math.abs(on[j + 1] - off[j + 1]), Math.abs(on[j + 2] - off[j + 2]))
      if (d > 8) moved++
    }
    return { meshCount: mesh.count, aroundAnimalPct: tot ? +(100 * moved / tot).toFixed(2) : 0, sampled: tot }
  })
  await page.screenshot({ path: `qa/wow2-sub-${CHAPTER}-bubbles.png` })

  // ---- 4. the beads: force weather.js's own falling edge -----------------
  await page.keyboard.up('KeyW')
  await page.keyboard.up('KeyE')
  out.beadForced = await page.evaluate(() => {
    const g = window.__capy, capy = g.capy
    // fabricate the falling edge the timer wants without waiting on the real
    // physics to surface: hand-drive weather.js's own tracker through one
    // update() above 0.3 m of depth, then one below it.
    const wasDiving = capy.diving, wasDepth = capy.depth
    capy.diving = true; capy.depth = 0.8
    g.weather.update(1 / 30)
    capy.depth = 0.1
    g.weather.update(1 / 30)
    const t0 = g.weather.subBeadT()
    g.weather.update(0.2)
    const t1 = g.weather.subBeadT()
    capy.diving = wasDiving; capy.depth = wasDepth
    return { t0: +t0.toFixed(3), t1: +t1.toFixed(3) }
  })
  out.beadPostDiff = await page.evaluate(() => {
    const g = window.__capy
    if (!g.post || !g.post.enabled || !g.weather) return { skipped: true }
    const capy = g.capy
    const wasDiving = capy.diving, wasDepth = capy.depth
    capy.diving = true; capy.depth = 0.8; g.weather.update(1 / 30)
    capy.depth = 0.1; g.weather.update(1 / 30)
    // ISOLATED from the ceiling/rays (both keyed to p.sub, which may be > 0
    // this deep into the dive): force sub to 0 for just this capture so the
    // only thing noSub2 can be cutting in this diff is the beads themselves.
    const wasSub = g.post.params.sub
    g.post.params.sub = 0
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.post.render(); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const wasNoSub2 = !!g.state.noSub2
    g.state.noSub2 = false
    const on = grab()
    g.state.noSub2 = true
    const off = grab()
    g.state.noSub2 = wasNoSub2
    g.post.params.sub = wasSub
    capy.diving = wasDiving; capy.depth = wasDepth
    let moved = 0, n = W * H
    for (let i = 0; i < n; i++) {
      const j = i * 4
      const d = Math.max(Math.abs(on[j] - off[j]), Math.abs(on[j + 1] - off[j + 1]), Math.abs(on[j + 2] - off[j + 2]))
      if (d > 8) moved++
    }
    return { wholeFramePct: +(100 * moved / n).toFixed(2), isolatedFromCeiling: true }
  })
  await page.screenshot({ path: `qa/wow2-sub-${CHAPTER}-beads.png` })

  // ---- 4b. and a REAL surfacing, for an eye-read uncontaminated by the ---
  // forced-state trick above (E is already up; buoyancy should lift it).
  let realDepth = await page.evaluate(() => window.__capy.capy.depth || 0)
  for (let i = 0; i < 20 && realDepth > 0.25; i++) {
    await page.waitForTimeout(300)
    realDepth = await page.evaluate(() => window.__capy.capy.depth || 0)
  }
  out.realSurface = { depth: +realDepth.toFixed(2) }
  await page.waitForTimeout(200)
  out.realBeadT = await page.evaluate(() => window.__capy.weather ? +window.__capy.weather.subBeadT().toFixed(3) : -1)
  await page.screenshot({ path: `qa/wow2-sub-${CHAPTER}-beads-real.png` })

  out.err2 = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null)
  await page.evaluate(o => fetch('/shot?name=wow2-sub-' + o.chapter + '.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
