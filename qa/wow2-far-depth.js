async page => {
  // ROADMAP-WOW2 V3 — THE FAR PLANE, MEASURED. ONE chapter per run (harness
  // rule: every run-code call under four minutes). A fresh boot, Begin via the
  // button, a real arrival via hud.cross, a settle plus a camera-still poll,
  // then, through the LIVE resting lens (the arrival frame is the frame that
  // matters):
  //   1. the atmosphere as it actually is: scene.fog near/far/colour,
  //      camera.far, the lens's position and forward — the reality check that
  //      says where a wedge at 300 m would read at all (a linear fog swallows
  //      anything past its far distance entirely)
  //   2. the planes-only depth sweep (qa/wow-depth-after.js's grid and bins,
  //      verbatim: fore < 4, near < 20, mid < 60, far < 400, else sky) with the
  //      far layer LIVE and with it CUT (game.state.noFar) — the differential
  //      the roadmap asks for, as the far share before/after
  //   3. the far layer's own census: triangles, draw calls, the mover's
  //      position projected through the lens (is it in the frustum now)
  //   4. two screenshots of the arrival frame, live and cut
  //      (qa/wow2-far-<chapter>-on.png / -off.png), to be read by eye.
  // Output: qa/wow2-far-depth-<chapter>.json. Console errors collected; 0 is
  // the bar. The CHAPTER literal is edited per run (or the file is copied with
  // it substituted — `__CHAPTER__` is the token the copy replaces).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const CHAPTER = '__CHAPTER__'
  const out = { errs, chapter: CHAPTER }

  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
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

  out.result = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera
    const raf = () => new Promise(res => requestAnimationFrame(res))
    const hex = c => '#' + c.getHexString()
    const p = cam.getWorldPosition(new T.Vector3()), d = cam.getWorldDirection(new T.Vector3())
    const fog = g.scene.fog
    const atmos = {
      fogNear: fog ? +fog.near.toFixed(1) : null, fogFar: fog ? +fog.far.toFixed(1) : null,
      fogColor: fog ? hex(fog.color) : null, camFar: cam.far,
      camPos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      camDir: [+d.x.toFixed(3), +d.y.toFixed(3), +d.z.toFixed(3)],
      // where a linear fog reads at 30 / 50 / 70 % of the fog colour
      fogAt: fog ? [0.3, 0.5, 0.7].map(k => +(fog.near + k * (fog.far - fog.near)).toFixed(0)) : null,
    }
    // ---- the planes-only sweep, verbatim from wow-depth-after.js ----------
    const vis = o => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true }
    const rc = new T.Raycaster(); rc.far = 5000
    const veil = o => o.isInstancedMesh && o.material && o.material.customProgramCacheKey && String(o.material.customProgramCacheKey()).indexOf('swayD') === 0
                   || (o.material && o.material.transparent && o.material.depthWrite === false)
    // 13 x 9 is the roadmap's grid (117 rays; one ray is 0.0085). A thin
    // horizon band can fall between two of its rows, so the same sweep is
    // also run at 39 x 27 (1053 rays) and reported as `fine`.
    const sweep = (NX, NY) => {
      NX = NX || 13; NY = NY || 9
      const bins = { fore: 0, near: 0, mid: 0, far: 0, sky: 0 }
      let n = 0, farHits = 0
      for (let yy = 0; yy < NY; yy++) for (let xx = 0; xx < NX; xx++) {
        rc.setFromCamera(new T.Vector2(-1 + (xx + 0.5) * 2 / NX, 1 - (yy + 0.5) * 2 / NY), cam)
        const hits = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder !== -20 && !veil(h.object))
        n++
        if (!hits.length) { bins.sky++; continue }
        const dd = hits[0].distance
        if (dd < 4) bins.fore++
        if (dd < 20) bins.near++; else if (dd < 60) bins.mid++; else if (dd < 400) bins.far++; else bins.sky++
        if (hits[0].object.name && hits[0].object.name.indexOf('far') === 0) farHits++
      }
      for (const k in bins) bins[k] = +(bins[k] / n).toFixed(3)
      bins.farLayerHits = farHits
      return bins
    }
    g.state.noFar = false; await raf(); await raf()
    const live = sweep(), liveFine = sweep(39, 27)
    const callsOn = g.renderer.info.render.calls, trisOn = g.renderer.info.render.triangles
    g.state.noFar = true; await raf(); await raf()
    const cut = sweep(), cutFine = sweep(39, 27)
    const callsOff = g.renderer.info.render.calls, trisOff = g.renderer.info.render.triangles
    g.state.noFar = false; await raf(); await raf()
    // ---- the far layer's own census ----------------------------------------
    const far = g.far && g.far.audit ? g.far.audit() : null
    // ---- the per-pixel diff: one pinned camera, the far group shown and
    // hidden, both renders inside this evaluate so nothing else moves. The
    // changed pixels ARE the mask; the bbox says where in the frame it sits.
    let diff = null
    if (g.far && g.far.group) {
      const pc = g.camera.clone(); pc.updateMatrixWorld()
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, pc); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
      const grp = g.far.group
      grp.visible = true; const on = grab()
      grp.visible = false; const off = grab()
      grp.visible = true
      let n = 0, sum = 0, x0 = W, x1 = 0, y0 = H, y1 = 0
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4
        const dd = Math.max(Math.abs(on[j] - off[j]), Math.abs(on[j + 1] - off[j + 1]), Math.abs(on[j + 2] - off[j + 2]))
        if (dd > 8) { n++; sum += dd; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
      diff = { px: n, pct: +(100 * n / (W * H)).toFixed(2), meanDelta: n ? +(sum / n).toFixed(1) : 0, bbox: n ? [x0, y0, x1, y1] : null, W, H }
    }
    let mover = null
    if (far && far.mover) {
      const v = new T.Vector3(far.mover[0], far.mover[1], far.mover[2]).project(cam)
      mover = { at: far.mover, ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)],
                inFrustum: v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z > -1 && v.z < 1 }
    }
    return { biome: g.biome.current, atmos, live, cut, liveFine, cutFine,
             delta: { far: +(live.far - cut.far).toFixed(3), sky: +(live.sky - cut.sky).toFixed(3),
                      farFine: +(liveFine.far - cutFine.far).toFixed(3), skyFine: +(liveFine.sky - cutFine.sky).toFixed(3),
                      calls: callsOn - callsOff, tris: trisOn - trisOff },
             far, mover, diff, rung: g.state.perfRung }
  })
  await page.screenshot({ path: 'qa/wow2-far-' + CHAPTER + '-on.png' })
  await page.evaluate(() => { window.__capy.state.noFar = true })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'qa/wow2-far-' + CHAPTER + '-off.png' })
  await page.evaluate(() => { window.__capy.state.noFar = false })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-far-depth-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
