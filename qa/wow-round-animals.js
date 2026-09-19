async page => {
  // ROADMAP-WOW G5 item 4 — THE ANIMALS MADE ROUND, the sheet. Per chapter,
  // the animals npc.js builds as part lists (the ibis and the gull in Sydney,
  // the llama and the dog in Pasto — Antarctica's gentoos are antarctic.js's
  // and not on this sheet), each shot close from its front quarter and from
  // its side in the RAW own-camera render (qa/art-review.js's window.__art:
  // no composite, the model judged as a model), FLAT then ROUND —
  // game.state.noRound toggled between the pair, two frames apart, so the
  // pair differs by the normals and nothing else. Read by eye: rounder, no
  // lighting seam across a sphere-built part, wings and beaks still crisp.
  // Arrive by the title picker (chapter one) or hud.cross() (trap 36).
  //
  // ONE CHAPTER PER RUN — set RUN below (trap 14: no argv in run-code). The
  // shots land as qa/RND-<chapter>-<animal>-<flat|round>-<n>.png and the
  // sheet as qa/wow-round-animals.json.png.
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
      // an instance's world position and yaw off an InstancedMesh
      inst(name, i) {
        const m = g.scene.getObjectByName(name)
        if (!m) return null
        const M = new T.Matrix4(); m.getMatrixAt(i, M)
        M.premultiply(m.matrixWorld)
        const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
        M.decompose(p, q, s)
        const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
        return { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(f.x, f.z), mat: m.material.flatShading ? 'flat' : 'round' }
      },
      // a shot of an instance from (back, side, up) in its own frame, aimed
      // at its origin lifted by aimY
      instShot(name, i, back, side, up, aimY, fov) {
        const b = this.inst(name, i)
        if (!b) return ''
        const f = { x: Math.sin(b.yaw), z: Math.cos(b.yaw) }
        const r = { x: Math.cos(b.yaw), z: -Math.sin(b.yaw) }
        return this.render(this.cam(b.x - f.x * back + r.x * side, b.y + up, b.z - f.z * back + r.z * side, b.x, b.y + (aimY || 0), b.z, fov || 30))
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
  // the pair: flat, then round, each from the front quarter and the side.
  // The toggle is polled once a frame in npc.js's update; two frames is
  // plenty, and the material read back on the instance says which it was.
  const pair = async (chapter, animal, mesh, idx, front, side) => {
    const rec = {}
    for (const st of ['flat', 'round']) {
      await page.evaluate((flat) => { window.__capy.state.noRound = flat }, st === 'flat')
      await page.waitForTimeout(160)
      rec[st] = await page.evaluate((a) => { const b = window.__art.inst(a.m, a.i); return b ? b.mat : null }, { m: mesh, i: idx })
      const S = (a) => window.__art.instShot(a.m, a.i, a.v[0], a.v[1], a.v[2], a.v[3], a.v[4])
      await shot('RND-' + chapter + '-' + animal + '-' + st + '-1', S, { m: mesh, i: idx, v: front })
      await shot('RND-' + chapter + '-' + animal + '-' + st + '-2', S, { m: mesh, i: idx, v: side })
    }
    await page.evaluate(() => { window.__capy.state.noRound = false })
    return rec
  }

  // ---- the rows ----
  const RUN = ['pasto']
  const errAt = () => errs.length

  for (let ci = 0; ci < RUN.length; ci++) {
    const name = RUN[ci]
    const e0 = errAt()
    const rec = await arrive(name, ci === 0)
    out.rows[name] = rec

    if (name === 'sydney') {
      // THE IBIS (a sphere body, a sphere head on a cylinder neck, box tail
      // and feet, cylinder beak) and THE GULL (sphere body and head, box
      // wings, cone beak). Both close: a metre and a half.
      rec.ibis = await pair('sydney', 'ibis', 'npcIbisBody', 0, [-1.3, 0.9, 0.55, 0.05, 28], [0.1, 1.5, 0.35, 0.05, 28])
      rec.gull = await pair('sydney', 'gull', 'npcGullBody', 0, [-1.1, 0.8, 0.45, 0.0, 28], [0.1, 1.3, 0.3, 0.0, 28])
    }

    if (name === 'pasto') {
      // THE LLAMA (box body, cylinder neck, the skull now a scaled sphere with
      // the face block and ears as boxes) and THE STREET DOG (box body, the
      // skull now a scaled sphere with a box snout, nose and ears).
      rec.llama = await pair('pasto', 'llama', 'npcLlamaBody', 0, [3.2, 2.2, 1.6, 0.9, 30], [0.2, 3.6, 1.0, 0.8, 30])
      rec.dog = await pair('pasto', 'dog', 'npcDogBody', 0, [2.6, 1.7, 1.5, 0.25, 22], [0.1, 3.0, 1.2, 0.2, 22])
    }

    rec.errs = errs.slice(e0)
  }

  await page.evaluate(async (o) => { await fetch('/shot?name=wow-round-animals.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
