async page => {
  // ROADMAP-WOW A1 — THE PLANAR REFLECTION, per chapter. Arrive through the
  // hud's own cross (trap 36: switchTo never moves the camera), poll the lens
  // until it has stood still for a second, then in ONE task: the water's
  // screen mask from a colour-keyed raw render, the live frame and the cut
  // frame through the real pipeline (reflectDraw + post.render, nothing
  // ticked between them so the sparkle and the ripple are frozen), and the
  // per-pixel diff inside the mask. Then the honest cost: reflectDraw +
  // post.render x 30 with a readPixels drain at each end, ten interleaved
  // reps, median per arm. Then the swim cut.
  const CH = ['kyoto']
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  // Pretty pinned (the governor's rung 0) through the prefs file: the pass
  // parks from rung 1 and this machine runs six agents.
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(1500)
  const settle = async () => {
    let last = null, still = 0
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500)
      const p = await page.evaluate(() => { const c = window.__capy.camera.position; return [c.x, c.y, c.z] })
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) < 0.02) still++; else still = 0
      last = p
      if (still >= 2 && i >= 8) break
    }
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a))
  const put = (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); if (b.interpolatedPosition) b.interpolatedPosition.set(x, y, z) }, [x, y, z])
  // turn the rig by hand until the camera sits at bearing want FROM the animal
  const face = async (want) => {
    for (let i = 0; i < 40; i++) {
      const cy = await page.evaluate(() => window.__capy.input.camYaw)
      const e = wrap(want - cy)
      if (Math.abs(e) < 0.12) break
      const k = e > 0 ? 'KeyZ' : 'KeyX'
      await page.keyboard.down(k); await page.waitForTimeout(Math.min(400, 60 + Math.abs(e) * 250)); await page.keyboard.up(k)
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(200)
  }
  // The flagship frame per chapter: where the animal stands and where the
  // lens is (the bearing from the animal), looking across the water at the
  // thing the chapter says the water mirrors.
  const FRAME = {
    // yaw is frameShot's: the bearing from the animal to the lens, atan2(x, z), so 0 is a lens due south
    kyoto: { at: [26, 0.3, 19.5], yaw: 0, dist: 11, pitch: 0.34, raise: 1.4 },   // the pond's south shore, the pavilion across it
  }
  const out = { errs, rows: {} }
  for (const name of CH) {
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(4000)
    await settle()
    // what the pass did on the arrival frame itself (a pond off frame is 'water off frame', and free)
    const arrival = await page.evaluate(() => { const g = window.__capy; const i = g.reflectInfo(); return { why: i.why, ms: +i.ms.toFixed(2), cam: g.camera.position.toArray().map(v => +v.toFixed(1)) } })
    if (FRAME[name]) {
      const F = FRAME[name]
      await put(...F.at); await page.waitForTimeout(1500)
      // a frameShot, not the hand-turned rig: the resting lens drifts back
      // behind the animal, and a shot holds its bearing for the A/B
      await page.evaluate((F) => window.__capy.frameShot({ yaw: F.yaw, dist: F.dist, pitch: F.pitch, raise: F.raise, hold: 30 }), F)
      await page.waitForTimeout(2600)
    }
    const r = await page.evaluate(async (name) => {
      const g = window.__capy, T = g.THREE
      const started = !!g.state.started
      // ---- the water -------------------------------------------------------
      const waters = []
      g.scene.traverse(o => { if (o.isMesh && o.visible && o.material && o.material.userData && o.material.userData.grainReflect > 0) waters.push(o) })
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      const grab = () => { ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
      // ---- the mask: a keyed raw render ---------------------------------------
      const key = new T.MeshBasicMaterial({ color: 0xff00ff, fog: false })
      const saved = waters.map(w => w.material)
      waters.forEach(w => { w.material = key })
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, g.camera)
      const km = grab()
      waters.forEach((w, i) => { w.material = saved[i] })
      const n = W * H
      const mask = new Uint8Array(n)
      let mN = 0
      for (let i = 0; i < n; i++) { const j = i * 4; if (km[j] > 180 && km[j + 1] < 90 && km[j + 2] > 180) { mask[i] = 1; mN++ } }
      // ---- the two arms, one task -----------------------------------------
      g.state.noReflect = false
      g.reflectDraw(); g.post.render()
      const infoOn = g.reflectInfo()
      const on = grab()
      const onUrl = c2.toDataURL('image/png')
      g.state.noReflect = true
      g.reflectDraw(); g.post.render()
      const infoOff = g.reflectInfo()
      const off = grab()
      const offUrl = c2.toDataURL('image/png')
      g.state.noReflect = false
      g.reflectDraw(); g.post.render()
      let sum = 0, over12 = 0, sumOut = 0, nOut = 0
      for (let i = 0; i < n; i++) {
        const j = i * 4
        const d = Math.max(Math.abs(on[j] - off[j]), Math.abs(on[j + 1] - off[j + 1]), Math.abs(on[j + 2] - off[j + 2]))
        if (mask[i]) { sum += d; if (d >= 12) over12++ } else { sumOut += d; nOut++ }
      }
      // ---- the cost: interleaved, drained, ten reps ---------------------------
      const gl = g.renderer.getContext()
      const px = new Uint8Array(4)
      const drain = () => { g.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) }
      const arm = (cut) => {
        g.state.noReflect = cut
        g.reflectDraw(); g.post.render(); drain()
        const t0 = performance.now()
        for (let k = 0; k < 30; k++) { g.reflectDraw(); g.post.render() }
        drain()
        return (performance.now() - t0) / 30
      }
      const onMs = [], offMs = []
      for (let rep = 0; rep < 10; rep++) {
        if (rep & 1) { offMs.push(arm(true)); onMs.push(arm(false)) } else { onMs.push(arm(false)); offMs.push(arm(true)) }
      }
      g.state.noReflect = false
      const med = a => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(3) }
      const cam = g.camera.position
      const res = {
        biome: g.biome && g.biome.current, started, waters: waters.length, W, H,
        maskPct: +(100 * mN / n).toFixed(2), maskN: mN,
        inMaskMean: mN ? +(sum / mN).toFixed(2) : null, inMaskOver12Pct: mN ? +(100 * over12 / mN).toFixed(1) : null,
        outMaskMean: nOut ? +(sumOut / nOut).toFixed(3) : null,
        onMs: med(onMs), offMs: med(offMs), deltaMs: +(med(onMs) - med(offMs)).toFixed(3), onAll: onMs.map(v => +v.toFixed(2)), offAll: offMs.map(v => +v.toFixed(2)),
        capy: g.capy.position.toArray().map(v => +v.toFixed(1)), rung: g.state.perfRung, infoOn, infoOff, cam: [+cam.x.toFixed(1), +cam.y.toFixed(1), +cam.z.toFixed(1)],
        err: g.state.lastError ? String(g.state.lastError).slice(0, 120) : null,
      }
      await fetch('/shot?name=wow-reflect-' + name + '-on', { method: 'POST', body: onUrl })
      await fetch('/shot?name=wow-reflect-' + name + '-off', { method: 'POST', body: offUrl })
      return res
    }, name)
    r.arrival = arrival
    out.rows[name] = r
    // ---- the swim cut: the animal into the water, E held for the dive --------
    if (name === 'kyoto') {
      await page.evaluate(() => { const b = window.__capy.capy.body; b.position.set(26, -0.2, -2); b.velocity.set(0, 0, 0); if (b.interpolatedPosition) b.interpolatedPosition.set(26, -0.2, -2) })
      await page.waitForTimeout(2500)
      const swim = await page.evaluate(() => { const g = window.__capy, c = g.capy; return { swim: !!c.swimming, dive: !!c.diving, pos: c.position.toArray().map(v => +v.toFixed(1)), y: +c.position.y.toFixed(2), camY: +g.camera.position.y.toFixed(2), info: g.reflectInfo() } })
      await page.keyboard.down('KeyE')
      const dive = []
      for (let k = 0; k < 8; k++) { await page.waitForTimeout(350); dive.push(await page.evaluate(() => { const g = window.__capy, c = g.capy; return { dive: !!c.diving, y: +c.position.y.toFixed(2), camY: +g.camera.position.y.toFixed(2), why: g.reflectInfo().why, k: +g.reflectInfo().k.toFixed(2), on: g.reflectInfo().on } })) }
      await page.keyboard.up('KeyE')
      await page.waitForTimeout(3000)
      const after = await page.evaluate(() => { const g = window.__capy; return { why: g.reflectInfo().why, k: +g.reflectInfo().k.toFixed(2), camY: +g.camera.position.y.toFixed(2) } })
      out.rows[name].swimCut = { swim, dive, after }
    }
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-reflect.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
