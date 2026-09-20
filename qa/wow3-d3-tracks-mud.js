async page => {
  // ROADMAP-WOW3 Part D item 3 — MUD (Pantanal's bank) AND WET-ON-STONE
  // (Venice's paving), proved the way V6's own qa/wow2-tracks.js proved sand
  // and snow: the flag's own A/B through one pinned camera (diff2, the
  // gate-refresh-tick trick, verbatim), read by eye against a near shot.
  // capybara.js's own gate (capyFootfallFx): 'mud' needs surfMat 'grass' AND
  // capySurfacePitch(x,z,y) <= capyTRACK_MUD_P (0.70) — the chapter's own
  // surfacePitch() return IS that pitch, so the scan below reads it directly
  // rather than guessing a spot. 'wet' needs a hard material (stone/timber/
  // gravel/metal) within capyTRACK_WET_T (12 s) of leaving the water — so
  // the capybara is put IN the water first, ticked until capySwimming reads
  // true, then walked straight up onto the nearest paving.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  const out = { errs, rows: {} }

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    window.__tk = {
      W, H, ctx, c2,
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

  // ---- MUD: the Pantanal's bank -------------------------------------------
  await page.evaluate(() => window.__capy.hud.cross('pantanal'))
  await page.waitForTimeout(9500)
  out.rows.pantanal = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, tk = window.__tk, inp = g.input
    const api = g.pantanal, p0 = g.capy.position
    // Scan a ring for a GRASS point whose own surfacePitch reads <= 0.60 (a
    // firmer mud signal than the 0.70 gate, likelier to sit a few metres
    // back from the exact waterline rather than right on it) — capyFootfallFx's
    // mud gate is <= 0.70; this scan asks for a bit more margin so an 8 m
    // walk has somewhere dry-ish to go. For each candidate, also check FOUR
    // walking directions 8 m out and keep whichever direction stays off
    // water and still reads as grass the whole way (sampled every 2 m) —
    // the first pass here found a point sitting exactly on the shoreline
    // (pitch 0.68) where every direction but a few centimetres led into the
    // water, and the animal never got anywhere (measured: 0.3 m in 25 s).
    let best = null, bd = 1e9
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let dx = -70; dx <= 70; dx += 2) for (let dz = -70; dz <= 70; dz += 2) {
      const x = p0.x + dx, z = p0.z + dz
      if (api.isOverWater && api.isOverWater(x, z)) continue
      const y = api.terrainHeight ? api.terrainHeight(x, z) : 0
      const pitch = api.surfacePitch(x, z, y + 0.34)
      if (api.surfaceMat() !== 'grass' || !(pitch <= 0.60)) continue
      let dir = null
      for (const [ux, uz] of DIRS) {
        let ok = true
        for (let s = 2; s <= 8; s += 2) {
          const xx = x + ux * s, zz = z + uz * s
          if (api.isOverWater && api.isOverWater(xx, zz)) { ok = false; break }
          if (api.surfaceMat() !== 'grass') { ok = false; break }
        }
        if (ok) { dir = [ux, uz]; break }
      }
      if (!dir) continue
      const d = dx * dx + dz * dz
      if (d < bd) { bd = d; best = { x, z, y, pitch, dir } }
    }
    if (!best) return { found: false }
    const b = g.capy.body
    b.position.set(best.x, best.y + 1.0, best.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.capy.wake(300)
    inp.x = 0; inp.z = 0; inp.run = false
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const bornBefore = g.capy.animAudit().tracks.born
    const from = { x: g.capy.position.x, z: g.capy.position.z }
    let walked = 0
    // ROADMAP-WOW3 D3: neither a straight line away from the water nor a
    // fixed back-and-forth heading got anywhere — both measured runs stuck
    // on an obstacle immediately (0/0.3 m of net motion, the legs cycling
    // in place the whole time, which is what actually produced the
    // hundreds of stray prints those two attempts logged at one point).
    // The bank is uneven ground the physics collides with in ways a flat
    // terrainHeight query does not see. So: retarget every 0.9 s to a
    // random point 1.5-3 m off the CURRENT position that still reads
    // grass and not water — several short, differently-aimed legs rather
    // than one committed heading, so one blocked direction does not stall
    // the whole walk.
    function rnd(a, b) { return a + Math.random() * (b - a) }
    let tx = from.x, tz = from.z, retargetAt = 0
    for (let i = 0; i < 60 * 25; i++) {
      const cp = g.capy.position
      if (i >= retargetAt) {
        retargetAt = i + 54
        let picked = false
        for (let tries = 0; tries < 10 && !picked; tries++) {
          const a = rnd(0, 6.283), r = rnd(1.5, 3)
          const cx = cp.x + Math.cos(a) * r, cz = cp.z + Math.sin(a) * r
          if (api.isOverWater && api.isOverWater(cx, cz)) continue
          const cy = api.terrainHeight ? api.terrainHeight(cx, cz) : cp.y
          api.surfacePitch(cx, cz, cy + 0.34)
          if (api.surfaceMat() !== 'grass') continue
          tx = cx; tz = cz; picked = true
        }
      }
      tk.steer(tx, tz, false)
      g.tick(1 / 60, false)
      walked += Math.hypot(g.capy.position.x - cp.x, g.capy.position.z - cp.z)
      if (walked >= 9) break
    }
    inp.x = 0; inp.z = 0; inp.run = false
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    const a0 = g.capy.animAudit()
    const p = g.capy.position
    // The live prints' OWN centre (tracksAudit's disc), not a from/to
    // midpoint — the walk above wanders (it retargets every 0.9 s rather
    // than holding one heading), so the midpoint of start and end is not
    // reliably where the footfalls actually landed.
    const ctr = a0.tracks.centre
    const mx = (ctr && ctr[0]) || (from.x + p.x) * 0.5, mz = (ctr && ctr[1]) || (from.z + p.z) * 0.5
    const my = api.terrainHeight ? api.terrainHeight(mx, mz) : best.y
    const cam = new T.PerspectiveCamera(40, 1280 / 760, 0.05, 400)
    cam.position.set(mx, my + 4.2, mz + 4.2)
    cam.lookAt(mx, my, mz); cam.updateMatrixWorld()
    const rows = []
    for (const at of [0, 10, 20]) {
      if (at > 0) for (let i = 0; i < 60 * 10; i++) g.tick(1 / 60, false)
      const d = tk.diff2(cam, 'noTracks')
      rows.push({ at, px: d.px, mean: d.mean, live: g.capy.animAudit().tracks.live })
      window['__mudShot' + at] = d.url
      if (at === 0) {
        const near = new T.PerspectiveCamera(34, 1280 / 760, 0.05, 400)
        near.position.set(mx + 0.4, my + 2.0, mz + 2.0)
        near.lookAt(mx, my, mz); near.updateMatrixWorld()
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, near); g.renderer.render(g.scene, near)
        window.__mudNear = g.renderer.domElement.toDataURL('image/png')
      }
    }
    return { found: true, patch: best, walked: +walked.toFixed(2), surfMat: a0.surfMat,
             bornBefore, bornAfter: a0.tracks.born, rows, rung: g.state.perfRung };
  })
  if (out.rows.pantanal.found) {
    const nurl = await page.evaluate(() => window.__mudNear)
    if (nurl) await page.evaluate(async (o) => { await window.__tk.shot(o.u, o.n) }, { n: 'wow3-d3-mud-near', u: nurl })
    for (const at of [0, 10, 20]) {
      const url = await page.evaluate((at) => window['__mudShot' + at], at)
      if (url) await page.evaluate(async (o) => { await window.__tk.shot(o.u, o.n) }, { n: 'wow3-d3-mud-' + at, u: url })
    }
  }

  await page.evaluate(async (o) => { await fetch('/shot?name=wow3-d3-mud.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
