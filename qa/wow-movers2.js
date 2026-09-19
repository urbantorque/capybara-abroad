async page => {
  // ROADMAP-WOW Part C — THE MOVERS UPLIFT, BATCH 2, verified. Same pattern as
  // qa/wow-movers.js (read that file's header): arrive by the title picker
  // (chapter one) or hud.cross() (trap 36 — never biome.switchTo, never digit
  // keys mid-game), wait for the resting camera to settle, get the mover
  // moving by its chapter api, and take TWO raw own-camera frames ~300 ms
  // apart while it moves (window.__art: no composite, the model judged as a
  // model), plus a side/close shot. The PNGs are read by eye — the fork must
  // read as a fork that has moved, the wheels as turned, the blink as a blink.
  // Console errors are collected per chapter.
  //
  // Rows: rio (the nine fragatas' fork and fingers, the ridden bird's plume),
  // monaco (the red car's wheels, wing, helmet), hanoi (the Cub's wheels),
  // drift (the lampflies' blink and two-tone body). ONE CHAPTER PER RUN — set
  // RUN below (trap 14: no argv in run-code). The shots land as
  // qa/MOV2-<chapter>-<n>.png and the sheet as qa/wow-movers2.json.png.
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
      objShot(o, back, side, up, aimY, fov) {
        o.updateMatrixWorld(true)
        const p = new T.Vector3().setFromMatrixPosition(o.matrixWorld)
        const q = new T.Quaternion().setFromRotationMatrix(o.matrixWorld)
        const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
        const r = new T.Vector3(1, 0, 0).applyQuaternion(q)
        const cx = p.x - f.x * back + r.x * side, cz = p.z - f.z * back + r.z * side
        return this.render(this.cam(cx, p.y + up, cz, p.x, p.y + (aimY || 0), p.z, fov || 36))
      },
      // from a world point with a yaw (an instance read off its matrix)
      ptShot(x, y, z, yaw, back, side, up, aimY, fov, aimSide) {
        const f = { x: Math.sin(yaw), z: Math.cos(yaw) }
        const r = { x: Math.cos(yaw), z: -Math.sin(yaw) }
        const as = aimSide || 0
        return this.render(this.cam(x - f.x * back + r.x * side, y + up, z - f.z * back + r.z * side, x + r.x * as, y + (aimY || 0), z + r.z * as, fov || 36))
      },
      // an instance's world position, yaw and scale, off an InstancedMesh
      inst(name, i) {
        const m = g.scene.getObjectByName(name)
        if (!m) return null
        const M = new T.Matrix4(); m.getMatrixAt(i, M)
        M.premultiply(m.matrixWorld)
        const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
        M.decompose(p, q, s)
        const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
        return { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(f.x, f.z), sx: s.x, sy: s.y, sz: s.z }
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

  // ---- the rows ----
  const RUN = ['rio']
  const errAt = () => errs.length

  for (let ci = 0; ci < RUN.length; ci++) {
    const name = RUN[ci]
    const e0 = errAt()
    const rec = await arrive(name, ci === 0)
    out.rows[name] = rec

    if (name === 'rio') {
      // THE NINE FRAGATAS: bird 0 off the instanced mesh, framed from a world
      // point on its rear quarter (the fork nearest the lens), two frames
      // 300 ms apart; then from above (the play camera looks DOWN on them —
      // the W and the fan), and the fork's own scale between the frames.
      const B = (a) => { const b = window.__art.inst('rioFragatas', a[5]); return b ? window.__art.ptShot(b.x, b.y, b.z, b.yaw, a[0], a[1], a[2], a[3], a[4], a[6]) : '' }
      const s0 = await page.evaluate(() => ({ b: window.__art.inst('rioFragatas', 0), t: window.__art.inst('rioFragataTails', 0) }))
      await shot('MOV2-rio-1', B, [6.5, 2.2, 2.4, 0.0, 34, 0])
      await page.waitForTimeout(300)
      await shot('MOV2-rio-2', B, [6.5, 2.2, 2.4, 0.0, 34, 0])
      const s1 = await page.evaluate(() => ({ b: window.__art.inst('rioFragatas', 0), t: window.__art.inst('rioFragataTails', 0) }))
      await shot('MOV2-rio-3', B, [1.5, 0.0, 7.0, 0.0, 40, 0])     // in plan, from above
      await shot('MOV2-rio-4', B, [0.5, 6.0, 1.0, 0.0, 34, 0])     // the side: the fork and the fan
      await shot('MOV2-rio-8', B, [8.0, 0.0, 1.5, 0.0, 30, 0])     // dead astern: the fork, the dihedral
      await shot('MOV2-rio-9', B, [1.0, 1.9, 3.0, 0.0, 30, 0, 1.9])     // straight down on the right hand: the five fingers
      // THE BEAK LEADS: the heading the bird moved along over the 300 ms
      // against the yaw its matrix carries. Under a quarter turn apart is
      // "flies forwards"; the old code was a quarter turn out.
      if (s0.b && s1.b) {
        const vel = Math.atan2(s1.b.x - s0.b.x, s1.b.z - s0.b.z)
        let d = vel - s1.b.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI
        rec.heading = { velYaw: +vel.toFixed(2), birdYaw: +s1.b.yaw.toFixed(2), off: +d.toFixed(2), moved: +Math.hypot(s1.b.x - s0.b.x, s1.b.z - s0.b.z).toFixed(2) }
      }
      rec.fork = s0.t && s1.t ? { open0: +s0.t.sx.toFixed(3), open1: +s1.t.sx.toFixed(3), y: +s1.t.y.toFixed(1) } : null
      // ...and over 3 s, how far the fork scissors and whether it ever sits still
      rec.forkRange = await page.evaluate(() => new Promise(res => {
        let mn = 9, mx = -9, n = 0
        const t = setInterval(() => {
          const a = window.__art.inst('rioFragataTails', 0)
          if (a) { mn = Math.min(mn, a.sx); mx = Math.max(mx, a.sx) }
          if (++n >= 30) { clearInterval(t); res({ min: +mn.toFixed(3), max: +mx.toFixed(3) }) }
        }, 100)
      }))
      // THE RIDDEN BIRD: summon it, let it come in, two frames from its rear
      // quarter where the fingers' band and the body-against-wing tone read.
      rec.summon = await page.evaluate(() => window.__capy.condor.summon())
      await page.waitForTimeout(2600)
      const C = () => window.__art.objShot(window.__capy.condor.group, 7.5, 2.5, 3.2, 0.1, 34)
      await shot('MOV2-rio-5', C)
      await page.waitForTimeout(300)
      await shot('MOV2-rio-6', C)
      await shot('MOV2-rio-7', () => window.__art.objShot(window.__capy.condor.group, 3.0, 0.0, 6.0, 0.0, 36))
      rec.condor = await page.evaluate(() => { const c = window.__capy.condor; return { st: c.state, pos: c.group.position.toArray().map(v => +v.toFixed(1)) } })
    }

    rec.errs = errs.slice(e0)
  }

  await page.evaluate(async (o) => { await fetch('/shot?name=wow-movers2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
