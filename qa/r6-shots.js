async page => {
  // R6's acceptance frames, with exactly the cameras qa/art-review.js uses so
  // the crops go back into the sheet. The roster portrait and the gardener are
  // in Sydney; the local is in Venice, which is one of the fifteen chapters
  // whose entire population is hand-built figures and where none of the
  // roster's second colours do anything at all.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__art = {
      cam(x, y, z, tx, ty, tz, fov) {
        const c = new T.PerspectiveCamera(fov || 32, 1280 / 760, 0.02, 900)
        c.position.set(x, y, z); c.lookAt(tx, ty, tz); c.updateMatrixWorld()
        return c
      },
      render(c) {
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        return g.renderer.domElement.toDataURL('image/png')
      },
      people() {
        const rows = []
        const src = g.npcs && g.npcs.debugRows ? g.npcs.debugRows() : null
        return src || rows
      },
      personShot(r, dist, up, fov, side, aimY) {
        const ang = Math.atan2(r.fx, r.fz) + (side || 0)
        const ay = r.y + (aimY === undefined ? 1.15 : aimY) * (r.sy || 1)
        return this.render(this.cam(r.x + Math.sin(ang) * dist, ay + up, r.z + Math.cos(ang) * dist,
                                    r.x, ay, r.z, fov))
      },
      loc(l) { return { x: l.x, y: l.y, z: l.z, fx: Math.sin(l.ry), fz: Math.cos(l.ry), sy: 1 } }
    }
  })

  const shot = async (name, fn) => {
    try {
      const url = await page.evaluate(fn)
      if (url && url.length > 100) {
        await page.evaluate(async o => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
                            { n: name, u: url })
      } else errs.push(name + ': EMPTY')
    } catch (e) { errs.push(name + ': ' + String(e.message || e)) }
  }

  // The roster's own rows. art-review.js builds them from the npc module's
  // instanced matrices; this reads them the same way it does.
  const ppl = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const rows = []
    let iTorso = null
    g.scene.traverse(o => {
      if (!o.isInstancedMesh || !o.material || !o.material.vertexColors) return
      if (o.material.color.getHex() !== 0xfaf6ec) return
      // the torso is the tallest-count body mesh whose geometry has two boxes
      if (!iTorso && o.geometry.attributes.position.count === 72) iTorso = o
    })
    if (!iTorso) return null
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
    for (let i = 0; i < iTorso.count; i++) {
      iTorso.getMatrixAt(i, m); m.decompose(p, q, s)
      const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
      rows.push({ i, x: p.x, y: p.y, z: p.z, fx: f.x, fz: f.z, sy: s.y })
    }
    window.__ppl = rows
    return rows.length
  })

  await shot('AR-tourist-front', () => {
    const A = window.__art
    const r = (window.__ppl || []).find(r => r.i < 11 && Math.abs(r.y) < 3)
    return r ? A.personShot(r, 2.6, 0.25, 34) : ''
  })
  await shot('AR-gardener', () => {
    const A = window.__art
    const r = (window.__ppl || [])[11]
    return r ? A.personShot(r, 2.8, 0.4, 34, 0.5) : ''
  })
  // ...and closer than the sheet goes, because a 6 mm eye white at 2.6 m is
  // four pixels and the whole question is whether it reads.
  await shot('R6-face-close', () => {
    const A = window.__art
    const r = (window.__ppl || []).find(r => r.i < 11 && Math.abs(r.y) < 3)
    return r ? A.personShot(r, 1.9, 0.26, 22, 0, 1.60) : ''
  })
  await page.screenshot({ path: 'qa/AR-play-sydney.png' })

  // ---- Venice, for the locals ---------------------------------------------
  await page.evaluate(() => window.__capy.biome.switchTo('venice'))
  await page.waitForTimeout(8000)
  const nLoc = await page.evaluate(() => {
    const g = window.__capy
    const L = (g.locals || []).filter(l => l.biome === 'venice' && l.group)
    window.__loc = L.map(l => ({ x: l.group.position.x, y: l.group.position.y,
                                 z: l.group.position.z, ry: l.group.rotation.y, id: l.id || '',
                                 hat: !!(l.group.children.some(c => c.isObject3D)) }))
    return L.length
  })
  await shot('AR-venice-local-a', () => {
    const A = window.__art, l = window.__loc[0]
    return l ? A.personShot(A.loc(l), 2.6, 0.3, 34, 0.45) : ''
  })
  await shot('R6-local-close', () => {
    const A = window.__art, l = window.__loc[0]
    return l ? A.personShot(A.loc(l), 1.9, 0.24, 22, 0.30, 1.58) : ''
  })
  // ...and one with a hat on, if any of them has one
  await shot('R6-local-hat', () => {
    const A = window.__art
    const g = window.__capy
    const L = (g.locals || []).filter(l => l.biome === 'venice' && l.group)
    for (const l of L) {
      let hat = false
      l.group.traverse(o => { if (o.isMesh && o.geometry &&
        o.geometry.attributes.position.count === 192) hat = true })
      if (hat) return A.personShot(A.loc({ x: l.group.position.x, y: l.group.position.y,
        z: l.group.position.z, ry: l.group.rotation.y }), 2.1, 0.42, 26, 0.35, 1.62)
    }
    return ''
  })

  await page.evaluate(async o => {
    await fetch('/shot?name=R6-shots.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { errs, ppl, nLoc })
}
