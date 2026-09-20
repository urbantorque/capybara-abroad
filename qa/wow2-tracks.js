async page => {
  // ROADMAP-WOW2 V6 — TRACKS. Eight metres walked on Palawan's sand and
  // Antarctica's snow, then a pinned lens looking back down the trail: the
  // decal pixels in that frame at 0 / 10 / 20 s, live against `noTracks`
  // (the SAME pinned camera and the same world time in both arms — the flag
  // is flipped between two renders of one frame, which is the only honest
  // before when nothing else may move). Then Kyoto's pond: the swim wake's
  // own pixels, the same way.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  const out = { errs, rows: {}, wake: {} }

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    window.__tk = {
      W, H, ctx, c2,
      // the flag's own A/B through one pinned camera: render, flip, render,
      // count. Two renders back to back, so the shadow pass has settled
      // (qa/wow2-footfall.js's trap).
      // THE GATE IS PUBLISHED FROM THE TICK, NOT THE RENDER. capybara.js
      // calls tracksTick once a frame and that is what writes uTrkOn, so a
      // flag flipped between two renders changed nothing at all (measured:
      // 0 px with twenty prints on the ground). One 1.7 ms tick after each
      // flip refreshes the gate and ages the pool by nothing. It has to be
      // a VERY short one (1/60000 s): at 1/600 the chapter's own mote field
      // — 170 drifting snow quads in Antarctica — moved between the two
      // arms and wrote itself into the difference (measured: 771 px at 0 s
      // and 90 px at 10 s off the same thirteen prints).
      diff(cam, flag) {
        const st = g.state
        st[flag] = false
        g.tick(1 / 60000, false)
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, cam); g.renderer.render(g.scene, cam)
        ctx.drawImage(g.renderer.domElement, 0, 0)
        const A = ctx.getImageData(0, 0, W, H).data
        st[flag] = true
        g.tick(1 / 60000, false)
        g.renderer.render(g.scene, cam); g.renderer.render(g.scene, cam)
        ctx.drawImage(g.renderer.domElement, 0, 0)
        const B = ctx.getImageData(0, 0, W, H).data
        st[flag] = false
        g.tick(1 / 60000, false)
        let px = 0, sum = 0
        const D = ctx.createImageData(W, H)
        for (let i = 0; i < W * H; i++) {
          const j = i * 4
          const d = Math.max(Math.abs(A[j] - B[j]), Math.abs(A[j + 1] - B[j + 1]), Math.abs(A[j + 2] - B[j + 2]))
          sum += d
          D.data[j + 3] = 255
          if (d > 8) { px++; D.data[j] = 255; D.data[j + 1] = 255; D.data[j + 2] = 255 }
        }
        ctx.putImageData(D, 0, 0)
        return { px, mean: +(sum / (W * H)).toFixed(3), url: c2.toDataURL('image/png') }
      },
      // TWICE, AND THE LEAST OF THE TWO (qa/wow-still.js's own rule): the
      // gate's refresh tick is a frame of the world however short it is, and
      // a penguin that walks through one arm of a pair is not a track.
      diff2(cam, flag) {
        const a = this.diff(cam, flag), b = this.diff(cam, flag)
        return a.px <= b.px ? a : b
      },
      steer(tx, tz, run) {
        const inp = g.input, p = g.capy.position
        const dx = tx - p.x, dz = tz - p.z, m = Math.hypot(dx, dz) || 1
        const cy = inp.camYaw || 0
        inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
        inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
        inp.run = !!run
        return m
      },
      shot(url, name) { return fetch('/shot?name=' + name, { method: 'POST', body: url }) },
    }
  })

  for (const [name, want] of [['palawan', 'sand'], ['antarctic', 'snow']]) {
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    const r = await page.evaluate((o) => {
      const g = window.__capy, T = g.THREE, tk = window.__tk, inp = g.input
      const api = g[o.name], p0 = g.capy.position
      let best = null, bd = 1e9
      for (let dx = -40; dx <= 40; dx += 2) for (let dz = -40; dz <= 40; dz += 2) {
        const x = p0.x + dx, z = p0.z + dz
        if (api.isOverWater && api.isOverWater(x, z)) continue
        const y = api.terrainHeight ? api.terrainHeight(x, z) : 0
        api.surfacePitch(x, z, y + 0.34)
        if (api.surfaceMat() !== o.want) continue
        const d = dx * dx + dz * dz
        if (d < bd) { bd = d; best = { x, z, y } }
      }
      if (!best) return { found: false }
      const b = g.capy.body
      b.position.set(best.x, best.y + 1.0, best.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.capy.wake(300)
      inp.x = 0; inp.z = 0; inp.run = false
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      // eight metres along +x, at a walk
      const from = { x: g.capy.position.x, z: g.capy.position.z }
      let walked = 0
      for (let i = 0; i < 60 * 25; i++) {
        const d = tk.steer(from.x + 8, from.z, false)
        g.tick(1 / 60, false)
        walked = Math.hypot(g.capy.position.x - from.x, g.capy.position.z - from.z)
        if (walked >= 8) break
      }
      inp.x = 0; inp.z = 0; inp.run = false
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      const tr0 = g.capy.animAudit().tracks
      // the lens: behind the animal, looking back down the trail it made
      // THE LENS LOOKS DOWN ON THE MIDDLE OF THE TRAIL, not back along it
      // from the animal's own height: Antarctica's snow patch is a slope and
      // a low lens put the whole trail behind a ridge (measured: 29 px on
      // thirteen prints, against Palawan's 1098 on twenty).
      const p = g.capy.position
      const mx = (from.x + p.x) * 0.5, mz = (from.z + p.z) * 0.5
      const my = api.terrainHeight ? api.terrainHeight(mx, mz) : best.y
      const cam = new T.PerspectiveCamera(40, 1280 / 760, 0.05, 400)
      cam.position.set(mx, my + 4.2, mz + 4.2)
      cam.lookAt(mx, my, mz); cam.updateMatrixWorld()
      const rows = []
      for (const at of [0, 10, 20]) {
        if (at > 0) for (let i = 0; i < 60 * 10; i++) g.tick(1 / 60, false)
        const d = tk.diff2(cam, 'noTracks')
        rows.push({ at, px: d.px, mean: d.mean, live: g.capy.animAudit().tracks.live })
        window['__tkShot' + at] = d.url
        if (at === 0) {
          // ...and the frame itself, closer, for the eye: the trail is a
          // pattern in the ground and a white-on-black mask cannot say
          // whether it reads as paws
          const near = new T.PerspectiveCamera(34, 1280 / 760, 0.05, 400)
          near.position.set(mx + 0.4, my + 2.0, mz + 2.0)
          near.lookAt(mx, my, mz); near.updateMatrixWorld()
          g.renderer.setRenderTarget(null)
          g.renderer.render(g.scene, near); g.renderer.render(g.scene, near)
          window.__tkNear = g.renderer.domElement.toDataURL('image/png')
        }
      }
      return { found: true, patch: best, walked: +walked.toFixed(2), tracks0: tr0, rows, rung: g.state.perfRung }
    }, { name, want })
    out.rows[name] = r
    if (r.found) {
      const nurl = await page.evaluate(() => window.__tkNear)
      if (nurl) await page.evaluate(async (o) => { await window.__tk.shot(o.u, o.n) }, { n: 'wow2-tracks-' + name + '-near', u: nurl })
    }
    if (r.found) for (const at of [0, 10, 20]) {
      const url = await page.evaluate((at) => window['__tkShot' + at], at)
      if (url) await page.evaluate(async (o) => { await window.__tk.shot(o.u, o.n) }, { n: 'wow2-tracks-' + name + '-' + at, u: url })
    }
  }

  // ---- the wake, on Kyoto's pond ------------------------------------------
  await page.evaluate(() => window.__capy.hud.cross('kyoto'))
  await page.waitForTimeout(9500)
  out.wake = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, tk = window.__tk, inp = g.input
    const api = g.kyoto, p0 = g.capy.position
    let best = null, bd = 1e9
    for (let dx = -60; dx <= 60; dx += 3) for (let dz = -60; dz <= 60; dz += 3) {
      const x = p0.x + dx, z = p0.z + dz
      if (!(api.isOverWater && api.isOverWater(x, z))) continue
      const d = dx * dx + dz * dz
      if (d < bd) { bd = d; best = { x, z } }
    }
    if (!best) return { found: false }
    g.capy.wake(300)
    const b = g.capy.body
    b.position.set(best.x, 1.2, best.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    // swim a short leg, then look down on the water behind
    const from = { x: g.capy.position.x, z: g.capy.position.z }
    let sw = 0
    for (let i = 0; i < 60 * 20; i++) {
      tk.steer(best.x + 14, best.z, true)
      g.tick(1 / 60, false)
      if (g.capy.animAudit().swimBobW > 0.5) sw++
      if (sw > 240) break
    }
    const a = g.capy.animAudit()
    const p = g.capy.position
    // DOWN ON THE WATER BEHIND HER. The animal swims toward +x, so the wake
    // is astern along -x; a lens at her own height looked ALONG the arms and
    // read them as slivers.
    const cam = new T.PerspectiveCamera(40, 1280 / 760, 0.05, 400)
    cam.position.set(p.x - 2.0, p.y + 3.6, p.z + 3.2)
    cam.lookAt(p.x - 2.6, p.y - 0.25, p.z); cam.updateMatrixWorld()
    // the frame itself, before the mask: a white-on-black diff cannot say
    // whether twelve quads read as a wake or as paving
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, cam); g.renderer.render(g.scene, cam)
    window.__wakeNear = g.renderer.domElement.toDataURL('image/png')
    const d = tk.diff2(cam, 'noTracks')
    window.__wakeShot = d.url
    inp.x = 0; inp.z = 0; inp.run = false
    return { found: true, at: best, swamTicks: sw, swimBobW: a.swimBobW, wakeCount: a.wakeCount, px: d.px, mean: d.mean,
             pos: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)] }
  })
  const nurl = await page.evaluate(() => window.__wakeNear)
  if (nurl) await page.evaluate(async (u) => { await window.__tk.shot(u, 'wow2-tracks-wake-near') }, nurl)
  const wurl = await page.evaluate(() => window.__wakeShot)
  if (wurl) await page.evaluate(async (u) => { await window.__tk.shot(u, 'wow2-tracks-wake') }, wurl)
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-tracks.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
