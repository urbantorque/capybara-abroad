async page => {
  // ROADMAP-WOW2 V1.3 — FOOTFALLS. Palawan's sand and Antarctica's snow: the
  // animal is steered (closed loop on input.x/z) to a patch the chapter's own
  // surfaceMat() calls sand or snow, walks and runs across it, and the
  // burst pool's lifetime count is read against the gait's own footfall
  // count — bursts per footfall, live against `noFootfall` — and a frame of
  // the run through an own lens is read by eye.
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
  const CH = [['palawan', 'sand'], ['antarctic', 'snow']]
  for (const [name, want] of CH) {
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    const r = await page.evaluate((o) => {
      const g = window.__capy, inp = g.input, T = g.THREE
      const api = g[o.name]
      const p0 = g.capy.position
      // the nearest point within 40 m whose material is the one wanted
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
      if (!best) return { found: false, at: [p0.x, p0.z], mat0: (api.surfacePitch(p0.x, p0.z, p0.y), api.surfaceMat()) }
      const steer = (tx, tz, run) => {
        const p = g.capy.position, dx = tx - p.x, dz = tz - p.z, m = Math.hypot(dx, dz) || 1
        const cy = inp.camYaw || 0
        inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
        inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
        inp.run = !!run
        return m
      }
      // put on it (the way qa/b8-hkroof3.js places the body): Antarctica's
      // snow is the high ground and a thirty-second walk did not arrive
      const b = g.capy.body
      b.position.set(best.x, best.y + 1.0, best.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      inp.x = 0; inp.z = 0; inp.run = false
      let k = 0
      for (; k < 120; k++) g.tick(1 / 60, false)
      // two arms, each a 6 s walk then a 6 s run back and forth over the patch
      const arms = {}
      for (const arm of ['live', 'cut']) {
        g.state.noFootfall = arm === 'cut'
        const b0 = g.weather.burstAudit().born, s0 = g.capy.animAudit().stepN
        let onMat = 0, steps = 0, maxAlive = 0, maxCount = 0
        const here = { x: g.capy.position.x, z: g.capy.position.z }
        for (const run of [false, true]) {
          for (let i = 0; i < 60 * 6; i++) {
            const t = i / 60
            const tx = here.x + Math.cos(t * 0.9) * 3, tz = here.z + Math.sin(t * 0.9) * 3
            steer(tx, tz, run)
            g.tick(1 / 60, false)
            const a = g.capy.animAudit()
            if (a.surfMat === o.want) onMat++
            steps++
            const ba = g.weather.burstAudit()
            if (ba.alive > maxAlive) maxAlive = ba.alive
            if (ba.count > maxCount) maxCount = ba.count
          }
        }
        inp.x = 0; inp.z = 0; inp.run = false
        const b1 = g.weather.burstAudit().born, s1 = g.capy.animAudit().stepN
        arms[arm] = { born: b1 - b0, footfalls: s1 - s0, perFootfall: (s1 - s0) > 0 ? +((b1 - b0) / (s1 - s0)).toFixed(2) : null,
                      onMatPct: +(100 * onMat / steps).toFixed(0), maxAlive, maxQuadCount: maxCount, rowN: g.weather.burstAudit().rowN }
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      }
      g.state.noFootfall = false
      // the picture: a run past an own lens, caught two frames after a footfall
      inp.run = true
      const here = { x: g.capy.position.x, z: g.capy.position.z }
      let shotUrl = null, sp0 = g.capy.animAudit().stepN, since = -1
      for (let i = 0; i < 60 * 6 && !shotUrl; i++) {
        const t = i / 60
        steer(here.x + Math.cos(t * 0.9) * 3, here.z + Math.sin(t * 0.9) * 3, true)
        g.tick(1 / 60, false)
        const a = g.capy.animAudit()
        if (a.stepPhase !== sp0) { sp0 = a.stepPhase; since = 0 } else if (since >= 0) since++
        if (since === 3 && i > 90 && a.surfMat === o.want) {
          const p = g.capy.position
          const yaw = g.capy.group ? g.capy.group.rotation.y : 0
          const c = new T.PerspectiveCamera(34, 1280 / 760, 0.05, 400)
          c.position.set(p.x + Math.sin(yaw + 1.9) * 2.6, p.y + 0.5, p.z + Math.cos(yaw + 1.9) * 2.6)
          c.lookAt(p.x, p.y - 0.15, p.z); c.updateMatrixWorld()
          g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c)
          shotUrl = g.renderer.domElement.toDataURL('image/png')
          // ...and the burst's own pixels in that frame: the same render with
          // the burst slots off the mesh's count (the row's instances stay)
          const W = g.renderer.domElement.width, H = g.renderer.domElement.height
          const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
          const ctx = c2.getContext('2d', { willReadFrequently: true })
          // RENDERED TWICE BEFORE THE FIRST GRAB: the first render after a
          // run of render-less ticks draws a different animal shadow from
          // the second (measured: a 50 k px trapezoid in a same-same diff),
          // so both arms of the diff are taken from a settled renderer.
          g.renderer.render(g.scene, c)
          ctx.drawImage(g.renderer.domElement, 0, 0)
          const A = ctx.getImageData(0, 0, W, H).data
          g.renderer.render(g.scene, c)
          ctx.drawImage(g.renderer.domElement, 0, 0)
          const A2 = ctx.getImageData(0, 0, W, H).data
          let same = 0
          for (let q = 0; q < W * H; q++) { const j = q * 4; if (Math.max(Math.abs(A[j] - A2[j]), Math.abs(A[j + 1] - A2[j + 1]), Math.abs(A[j + 2] - A2[j + 2])) > 8) same++ }
          const ba = g.weather.burstAudit(), mesh = ba.mesh, was = mesh.count
          mesh.count = ba.base
          g.renderer.render(g.scene, c)
          mesh.count = was
          ctx.drawImage(g.renderer.domElement, 0, 0)
          const B = ctx.getImageData(0, 0, W, H).data
          let px = 0
          const D = ctx.createImageData(W, H)
          for (let q = 0; q < W * H; q++) { const j = q * 4; const d = Math.max(Math.abs(A[j] - B[j]), Math.abs(A[j + 1] - B[j + 1]), Math.abs(A[j + 2] - B[j + 2])); D.data[j + 3] = 255; if (d > 8) { px++; D.data[j] = 255; D.data[j + 1] = 255; D.data[j + 2] = 255 } }
          ctx.putImageData(D, 0, 0)
          window.__ffDiff = c2.toDataURL('image/png')
          window.__ffPx = { burstPx: px, sameSamePx: same, alive: ba.alive, count: was, base: ba.base }
        }
      }
      inp.x = 0; inp.z = 0; inp.run = false
      window.__ffShot = shotUrl
      return { found: true, patch: best, settled: k, arms, shot: window.__ffPx || null, mat: (api.surfacePitch(g.capy.position.x, g.capy.position.z, g.capy.position.y), api.surfaceMat()), rung: g.state.perfRung }
    }, { name, want })
    out.rows[name] = r
    const url = await page.evaluate(() => window.__ffShot)
    if (url) await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: 'wow2-footfall-' + name, u: url })
    const durl = await page.evaluate(() => window.__ffDiff)
    if (durl) await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: 'wow2-footfall-' + name + '-diff', u: durl })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-footfall.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
