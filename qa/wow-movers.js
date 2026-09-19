async page => {
  // ROADMAP-WOW Part C — THE MOVERS UPLIFT, verified. Per marquee mover: arrive
  // by the title picker (chapter one) or hud.cross() (trap 36 — never
  // biome.switchTo, never digit keys mid-game), wait for the resting camera
  // to settle, start the mover's own motion by its chapter api, and take TWO
  // raw own-camera frames ~300 ms apart while it moves (qa/art-review.js's
  // window.__art pattern: no composite, the model judged as a model), plus a
  // close shot. The PNGs are read by eye — the rotor must read as a rotor,
  // the wake as a wake, the wheels as turning (two frames differ at the wheel
  // and nowhere else). Console errors are collected per chapter.
  //
  // Edit ONLY to add rows; the shots land as qa/MOV-<chapter>-<n>.png and the
  // sheet as qa/wow-movers.json.png.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  const out = { shots: [], errs, rows: {} }

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__art = {
      cam(px, py, pz, tx, ty, tz, fov) {
        const c = new T.PerspectiveCamera(fov || 34, 1280 / 760, 0.05, 600)
        c.position.set(px, py, pz); c.lookAt(tx, ty, tz); c.updateMatrixWorld()
        return c
      },
      render(c) {
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        return g.renderer.domElement.toDataURL('image/png')
      },
      // a shot of an object from its own behind-quarter: `o` is an Object3D,
      // the camera sits `back` along its -Z (world), `side` along its +X,
      // `up` above, looking at the object's origin lifted by `aimY`.
      objShot(o, back, side, up, aimY, fov) {
        o.updateMatrixWorld(true)
        const p = new T.Vector3().setFromMatrixPosition(o.matrixWorld)
        const q = new T.Quaternion().setFromRotationMatrix(o.matrixWorld)
        const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
        const r = new T.Vector3(1, 0, 0).applyQuaternion(q)
        const cx = p.x - f.x * back + r.x * side, cz = p.z - f.z * back + r.z * side
        return this.render(this.cam(cx, p.y + up, cz, p.x, p.y + (aimY || 0), p.z, fov || 36))
      },
      // the same, from a fixed world point (for a mover whose group is not a
      // single Object3D — a pod, a bangka read off its api)
      ptShot(x, y, z, yaw, back, side, up, aimY, fov) {
        const f = { x: Math.sin(yaw), z: Math.cos(yaw) }
        const r = { x: Math.cos(yaw), z: -Math.sin(yaw) }
        return this.render(this.cam(x - f.x * back + r.x * side, y + up, z - f.z * back + r.z * side, x, y + (aimY || 0), z, fov || 36))
      },
    }
  })

  const post = async (name, url) => {
    if (!url || url.length < 100) { out.shots.push(name + ':EMPTY'); return }
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url })
    out.shots.push(name)
  }
  const shot = async (name, fn, arg) => {
    try {
      const url = await page.evaluate(fn, arg)
      await post(name, url)
    } catch (e) { errs.push(name + ': ' + String(e.message || e)) }
  }
  // the resting camera settled: position moved < 0.05 m over a second
  const settle = async () => {
    let last = null
    for (let i = 0; i < 24; i++) {
      const p = await page.evaluate(() => { const c = window.__capy.camera.position; return [c.x, c.y, c.z] })
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) < 0.05) return true
      last = p
      await page.waitForTimeout(1000)
    }
    return false
  }
  const arrive = async (name, first) => {
    if (first) {
      await page.keyboard.press('Digit1')
      await page.waitForTimeout(7000)
      if (name !== 'sydney') { await page.evaluate((n) => window.__capy.hud.cross(n), name); await page.waitForTimeout(9500) }
    } else {
      await page.evaluate((n) => window.__capy.hud.cross(n), name)
      await page.waitForTimeout(9500)
    }
    const st = await page.evaluate(() => ({ biome: window.__capy.biome.current, started: !!window.__capy.state.started }))
    const settled = await settle()
    return Object.assign(st, { settled })
  }

  // ---- the rows: which chapters to run is the literal below (trap 14: no
  // argv in run-code) ----
  const RUN = ['pasto']
  const errAt = () => errs.length

  for (let ci = 0; ci < RUN.length; ci++) {
    const name = RUN[ci]
    const e0 = errAt()
    const rec = await arrive(name, ci === 0)
    out.rows[name] = rec

    if (name === 'pasto') {
      // THE CONDOR: summon it (parked at (0, 200, 0) until then), let it come
      // in on its spiral, shoot it three times on the way — the flap is the
      // laboured inbound beat, the fan's flex lags it.
      rec.summon = await page.evaluate(() => window.__capy.condor.summon())
      await page.waitForTimeout(1800)
      const C = () => window.__art.objShot(window.__capy.condor.group, 7.5, 2.5, 3.2, 0.1, 34)
      await shot('MOV-pasto-1', C)
      await page.waitForTimeout(300)
      await shot('MOV-pasto-2', C)
      rec.flap = await page.evaluate(() => { const c = window.__capy.condor; return { st: c.state, pos: c.group.position.toArray().map(v => +v.toFixed(1)) } })
      await page.waitForTimeout(2200)
      await shot('MOV-pasto-3', () => window.__art.objShot(window.__capy.condor.group, 4.0, -1.5, 2.2, 0.0, 30))
      // and from above, the play angle, where the fan and the ruff band read
      await shot('MOV-pasto-4', () => window.__art.objShot(window.__capy.condor.group, 3.0, 0.0, 6.0, 0.0, 36))
      rec.after = await page.evaluate(() => { const c = window.__capy.condor; return { st: c.state, pos: c.group.position.toArray().map(v => +v.toFixed(1)) } })
      // THE FLEX, MEASURED: the fan pivot (mirror > shoulder > elbow > wrist >
      // fan) against the shoulder's dihedral, sampled at 50 ms for 3 s. A
      // fan that trails the beat moves AGAINST the shoulder's change; a glide
      // holds it near flat. `against` counts samples where the two changes
      // have opposite signs; `fanRange` is how far the pivot swung.
      rec.flex = await page.evaluate(() => new Promise(res => {
        const g = window.__capy.condor.group
        const mirror = g.children.find(o => o.children.length && o.children[0].children.length > 1 && !o.children[0].isMesh)
        const shoulder = mirror && mirror.children[0]
        const elbow = shoulder && shoulder.children.find(o => !o.isMesh)
        const wrist = elbow && elbow.children.find(o => !o.isMesh)
        const fan = wrist && wrist.children[0]
        if (!fan) return res({ found: false })
        const rows = []
        let n = 0, against = 0, withIt = 0, pf = fan.rotation.z, ps = shoulder.rotation.z
        let fmin = 9, fmax = -9, smin = 9, smax = -9
        const t = setInterval(() => {
          const f = fan.rotation.z, s = shoulder.rotation.z
          const df = f - pf, ds = s - ps
          if (Math.abs(df) > 1e-4 && Math.abs(ds) > 1e-4) { if (df * ds < 0) against++; else withIt++ }
          fmin = Math.min(fmin, f); fmax = Math.max(fmax, f); smin = Math.min(smin, s); smax = Math.max(smax, s)
          if (n % 10 === 0) rows.push([+f.toFixed(3), +s.toFixed(3)])
          pf = f; ps = s
          if (++n >= 60) { clearInterval(t); res({ found: true, against, withIt, fanRange: +(fmax - fmin).toFixed(3), shoulderRange: +(smax - smin).toFixed(3), rows }) }
        }, 50)
      }))
    }

    rec.errs = errs.slice(e0)
  }

  await page.evaluate(async (o) => { await fetch('/shot?name=wow-movers.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
