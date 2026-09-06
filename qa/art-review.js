async page => {
  // ART REVIEW SHOTS. Own camera, raw scene render (no composite), so the
  // model is judged as a model. Every render + toDataURL in ONE evaluate.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const out = { shots: [], errs }

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__art = {
      cam(px, py, pz, tx, ty, tz, fov) {
        const c = new T.PerspectiveCamera(fov || 34, 1280 / 760, 0.05, 400)
        c.position.set(px, py, pz); c.lookAt(tx, ty, tz); c.updateMatrixWorld()
        return c
      },
      render(c) {
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        return g.renderer.domElement.toDataURL('image/png')
      },
      capyShot(yawOff, dist, up, aimY, aimFwd, fov) {
        const p = g.capy.position
        const my = (g.capy.model || g.capy.group).rotation.y
        const fx = Math.sin(my), fz = Math.cos(my)
        const ax = p.x + fx * (aimFwd || 0), az = p.z + fz * (aimFwd || 0), ay = p.y + (aimY || 0)
        const yaw = my + yawOff
        return this.render(this.cam(ax + Math.sin(yaw) * dist, ay + up, az + Math.cos(yaw) * dist, ax, ay, az, fov))
      },
      inst(vcount, count) {
        const res = []
        g.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.attributes.position.count === vcount && (!count || o.count === count)) res.push(o) })
        return res
      },
      people(mesh) {
        const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
        const rows = []
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m); m.decompose(p, q, s)
          const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
          rows.push({ i, x: p.x, y: p.y, z: p.z, fx: f.x, fz: f.z, sy: s.y })
        }
        return rows
      },
      personShot(r, dist, up, fov, side) {
        const ang = Math.atan2(r.fx, r.fz) + (side || 0)
        const ay = r.y + 1.15 * (r.sy || 1)
        return this.render(this.cam(r.x + Math.sin(ang) * dist, ay + up, r.z + Math.cos(ang) * dist, r.x, ay, r.z, fov))
      },
      loc(l) { return { x: l.x, y: l.y, z: l.z, fx: Math.sin(l.ry), fz: Math.cos(l.ry), sy: 1 } },
      put(x, y, z) {
        const b = g.capy.body
        b.position.set(x, y, z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      },
      locals(name) {
        const L = (g.locals || []).filter(l => l.biome === name && l.group)
        window.__loc = L.map(l => ({ x: l.group.position.x, y: l.group.position.y, z: l.group.position.z, ry: l.group.rotation.y, id: l.id || '' }))
        return { n: L.length, ids: window.__loc.slice(0, 8).map(l => l.id) }
      },
      centroidShot(rows, n, dx, dy, dz) {
        if (!rows || !rows.length) return ''
        rows = rows.slice()
        const r0 = rows[0]
        rows.sort((a, b) => ((a.x - r0.x) ** 2 + (a.z - r0.z) ** 2) - ((b.x - r0.x) ** 2 + (b.z - r0.z) ** 2))
        const six = rows.slice(0, n)
        let cx = 0, cz = 0, cy = 0
        for (const r of six) { cx += r.x; cz += r.z; cy += r.y }
        cx /= six.length; cz /= six.length; cy /= six.length
        return this.render(this.cam(cx + dx, cy + dy, cz + dz, cx, cy + 1.0, cz, 34))
      }
    }
  })
  const post = async (name, url) => {
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url })
    out.shots.push(name)
  }
  const shot = async (name, fn, arg) => {
    try {
      const url = await page.evaluate(fn, arg)
      if (url && url.length > 100) await post(name, url); else out.shots.push(name + ':EMPTY')
    } catch (e) { errs.push(name + ': ' + String(e.message || e)) }
  }
  const go = async (name) => {
    await page.evaluate((n) => window.__capy.biome.switchTo(n), name)
    await page.waitForTimeout(8000)
  }

  // ---- A. THE CAPYBARA, SYDNEY --------------------------------------------
  await shot('AR-capy-3q', () => window.__art.capyShot(0.75, 3.0, 0.75, 0.25, 0.1))
  await shot('AR-capy-side', () => window.__art.capyShot(Math.PI / 2, 3.2, 0.55, 0.25, 0.0))
  await shot('AR-capy-rear3q', () => window.__art.capyShot(Math.PI - 0.7, 3.0, 0.8, 0.25, 0.0))
  await shot('AR-capy-front', () => window.__art.capyShot(0.0, 2.8, 0.45, 0.28, 0.2))
  await shot('AR-capy-head', () => window.__art.capyShot(0.62, 1.55, 0.2, 0.26, 0.52, 38))
  await shot('AR-capy-top', () => window.__art.capyShot(0.4, 3.2, 3.2, 0.25, 0.0))
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft')
  await page.waitForTimeout(1400)
  await shot('AR-capy-run', () => window.__art.capyShot(Math.PI / 2 + 0.3, 3.4, 0.6, 0.3, 0.0))
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW')
  await page.waitForTimeout(800)
  await page.keyboard.press('Space'); await page.waitForTimeout(230)
  await shot('AR-capy-hop', () => window.__art.capyShot(Math.PI / 2 + 0.5, 3.6, 0.5, 0.5, 0.0))
  await page.waitForTimeout(1500)
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(140)
  await shot('AR-capy-wheek', () => window.__art.capyShot(0.35, 1.7, 0.25, 0.28, 0.5, 38))
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.completeTask('steal-hat', true) })
  await page.waitForTimeout(1500)
  await shot('AR-capy-sunhat', () => window.__art.capyShot(0.7, 2.6, 0.7, 0.3, 0.2))

  // ---- B. THE SYDNEY ROSTER -----------------------------------------------
  out.sydney = await page.evaluate(() => {
    const A = window.__art
    const tor = A.inst(72, 32)[0]
    if (!tor) return { none: true, cands: A.inst(72).map(m => m.count) }
    window.__ppl = A.people(tor)
    return { n: window.__ppl.length, sample: window.__ppl.slice(0, 3).map(r => [+r.x.toFixed(1), +r.y.toFixed(1), +r.z.toFixed(1), +r.sy.toFixed(2)]) }
  })
  await shot('AR-tourist-front', () => { const A = window.__art; const r = (window.__ppl || []).find(r => r.i < 11 && Math.abs(r.y) < 3); return r ? A.personShot(r, 2.6, 0.25, 34) : '' })
  await shot('AR-tourist-3q', () => { const A = window.__art; const r = (window.__ppl || []).find(r => r.i >= 3 && r.i < 11 && Math.abs(r.y) < 3); return r ? A.personShot(r, 2.8, 0.4, 34, 0.7) : '' })
  await shot('AR-gardener', () => { const A = window.__art; const r = (window.__ppl || [])[11]; return r ? A.personShot(r, 2.8, 0.4, 34, 0.5) : '' })
  await shot('AR-jogger', () => { const A = window.__art; const r = (window.__ppl || [])[13]; return r ? A.personShot(r, 2.8, 0.4, 34, 0.6) : '' })
  await shot('AR-crowd-group', () => { const A = window.__art; return A.centroidShot((window.__ppl || []).filter(r => r.i < 16 && Math.abs(r.y) < 3), 6, 6, 3.0, 7) })
  await shot('AR-ibis', () => {
    const A = window.__art, g = window.__capy
    const ib = []
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 6 && o.geometry.attributes.position.count > 100) ib.push(o) })
    if (!ib.length) return ''
    const r = A.people(ib[0])[0]
    return A.render(A.cam(r.x + 1.6, r.y + 1.0, r.z + 1.6, r.x, r.y + 0.35, r.z, 34))
  })
  await page.evaluate(() => {
    const A = window.__art, g = window.__capy
    const rows = (window.__ppl || []).filter(r => r.i < 16 && Math.abs(r.y) < 3)
    const r = rows[0]
    if (!r) return
    A.put(r.x + r.fx * 3.5, r.y + 0.6, r.z + r.fz * 3.5)
    setTimeout(() => g.frameShot({ yaw: Math.atan2(-r.fx, -r.fz) + Math.PI, dist: 7, pitch: 0.05, raise: 1.1, hold: 6 }), 800)
  })
  await page.waitForTimeout(2600)
  await page.screenshot({ path: 'qa/AR-play-sydney.png' }); out.shots.push('AR-play-sydney')

  // ---- C. PASTO: locals, llama, dog ---------------------------------------
  await go('pasto')
  out.pasto = await page.evaluate(() => {
    const A = window.__art, g = window.__capy
    const fa = g.faceAudit().filter(r => r.kind === 'pasto')
    const tors = A.inst(72).filter(m => m.count === fa.length)
    if (!tors.length) return { none: true, n: fa.length, cands: A.inst(72).map(m => m.count) }
    window.__pa = A.people(tors[0])
    return { n: fa.length, kinds: fa.map(r => r.id).slice(0, 14) }
  })
  await shot('AR-pasto-local-a', () => { const A = window.__art; const r = window.__pa && window.__pa[0]; return r ? A.personShot(r, 2.8, 0.35, 34, 0.5) : '' })
  await shot('AR-pasto-local-b', () => { const A = window.__art; const r = window.__pa && window.__pa[3]; return r ? A.personShot(r, 2.8, 0.35, 34, -0.6) : '' })
  await shot('AR-pasto-group', () => { const A = window.__art; return A.centroidShot(window.__pa || [], 7, 5, 3.2, 7) })
  await shot('AR-pasto-beasts', () => {
    const A = window.__art, g = window.__capy
    const cands = []
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count >= 3 && o.count <= 12 && o.geometry.attributes.position.count < 200) cands.push(o) })
    if (!cands.length) return ''
    const r = A.people(cands[0]).find(r => Math.abs(r.x) < 200)
    if (!r) return ''
    return A.render(A.cam(r.x + 3.2, r.y + 1.6, r.z + 3.2, r.x, r.y + 0.7, r.z, 34))
  })
  await page.screenshot({ path: 'qa/AR-play-pasto.png' }); out.shots.push('AR-play-pasto')

  // ---- D. VENICE: hand-built locals -------------------------------------
  await go('venice')
  out.venice = await page.evaluate(() => window.__art.locals('venice'))
  await shot('AR-venice-local-a', () => { const A = window.__art; const l = window.__loc[0]; return l ? A.personShot(A.loc(l), 2.6, 0.3, 34, 0.45) : '' })
  await shot('AR-venice-local-b', () => { const A = window.__art; const l = window.__loc[2] || window.__loc[1]; return l ? A.personShot(A.loc(l), 2.6, 0.3, 34, -0.5) : '' })
  await shot('AR-venice-local-wide', () => { const A = window.__art; const l = window.__loc[0]; if (!l) return ''; return A.render(A.cam(l.x + Math.sin(l.ry) * 6 + 2, l.y + 2.6, l.z + Math.cos(l.ry) * 6, l.x, l.y + 0.9, l.z, 34)) })

  // ---- E. MONACO: black tie + the casino staff ----------------------------
  await go('monaco')
  await page.evaluate(() => { window.__capy.completeTask('black-tie', true) })
  await page.waitForTimeout(1500)
  await shot('AR-capy-blacktie', () => window.__art.capyShot(0.7, 2.6, 0.7, 0.3, 0.2))
  await shot('AR-capy-blacktie-head', () => window.__art.capyShot(0.5, 1.6, 0.2, 0.26, 0.5, 38))
  out.monaco = await page.evaluate(() => window.__art.locals('monaco'))
  await shot('AR-monaco-local', () => { const A = window.__art; const l = window.__loc[1] || window.__loc[0]; return l ? A.personShot(A.loc(l), 2.6, 0.3, 34, 0.4) : '' })

  // ---- F. ANTARCTIC parka + KYOTO local -----------------------------------
  await go('antarctic')
  await page.evaluate(() => { window.__capy.completeTask('orca-ride', true) })
  await page.waitForTimeout(1500)
  await shot('AR-capy-parka', () => window.__art.capyShot(0.7, 2.6, 0.7, 0.3, 0.2))
  await go('kyoto')
  out.kyoto = await page.evaluate(() => window.__art.locals('kyoto'))
  await shot('AR-kyoto-local', () => { const A = window.__art; const l = window.__loc[0]; return l ? A.personShot(A.loc(l), 2.6, 0.3, 34, 0.4) : '' })
  await page.evaluate(async (o) => { await fetch('/shot?name=art-review.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
