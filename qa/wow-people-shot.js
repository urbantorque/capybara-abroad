async page => {
  // ONE PERSON — re-shoot the Marrakech and Rio crowd figures with the own-camera
  // pattern from qa/art-review.js (raw scene render, no composite), after the
  // crowds were rebuilt on npcPERSON. Compare against qa/WOW-sydney-roster.png.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const out = { shots: [], errs, pools: {} }

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
      byName(name) {
        let m = null
        g.scene.traverse(o => { if (!m && o.isInstancedMesh && o.name === name) m = o })
        return m
      },
      people(mesh) {
        const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
        const rows = []
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m); m.decompose(p, q, s)
          const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
          rows.push({ i, x: p.x, y: p.y, z: p.z, fx: f.x, fz: f.z, sy: s.y, sx: s.x })
        }
        return rows
      },
      personShot(r, dist, up, fov, side) {
        const ang = Math.atan2(r.fx, r.fz) + (side || 0)
        const ay = r.y + 1.15 * (r.sy || 1)
        return this.render(this.cam(r.x + Math.sin(ang) * dist, ay + up, r.z + Math.cos(ang) * dist, r.x, ay, r.z, fov))
      },
      // the nearest STANDING instance to the animal (sy close to sx: a sitter is squashed)
      nearest(name, standing) {
        const mesh = this.byName(name)
        if (!mesh) return null
        const cp = g.capy.position
        let best = null, bd = Infinity
        for (const r of this.people(mesh)) {
          if (standing && Math.abs(r.sy - r.sx) > 0.05) continue
          const d = (r.x - cp.x) ** 2 + (r.z - cp.z) ** 2
          if (d < bd) { bd = d; best = r }
        }
        return best
      },
      groupShot(name, n, dist, up) {
        const mesh = this.byName(name)
        if (!mesh) return ''
        const cp = g.capy.position
        const rows = this.people(mesh).sort((a, b) => ((a.x - cp.x) ** 2 + (a.z - cp.z) ** 2) - ((b.x - cp.x) ** 2 + (b.z - cp.z) ** 2)).slice(0, n)
        let cx = 0, cz = 0, cy = 0
        for (const r of rows) { cx += r.x; cz += r.z; cy += r.y }
        cx /= rows.length; cz /= rows.length; cy /= rows.length
        const ang = Math.atan2(cp.x - cx, cp.z - cz)
        return this.render(this.cam(cx + Math.sin(ang) * dist, cy + up, cz + Math.cos(ang) * dist, cx, cy + 1.0, cz, 34))
      },
      pools(prefix) {
        const res = {}
        g.scene.traverse(o => { if (o.isInstancedMesh && o.name.startsWith(prefix)) res[o.name] = { count: o.count, verts: o.geometry.attributes.position.count } })
        return res
      },
    }
  })
  const post = async (name, url) => {
    if (!url || url.length < 100) { out.shots.push(name + ':EMPTY'); return }
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url })
    out.shots.push(name)
  }
  const shot = async (name, fn, arg) => {
    try { await post(name, await page.evaluate(fn, arg)) } catch (e) { errs.push(name + ': ' + String(e.message || e)) }
  }

  // Sydney first: the standard, with the mouth now on the face
  await shot('WOW2-sydney-roster', () => {
    const A = window.__art, g = window.__capy
    const cp = g.capy.position
    let best = null, bd = Infinity
    g.scene.traverse(o => {
      if (!o.isInstancedMesh || o.geometry.attributes.position.count !== 144 || o.count !== 32) return
      for (const r of A.people(o)) { const d = (r.x - cp.x) ** 2 + (r.z - cp.z) ** 2; if (d < bd) { bd = d; best = r } }
    })
    return best ? A.personShot(best, 2.7, 0.35, 34, 0.5) : ''
  })

  for (const ch of [['sahara', 'sah'], ['rio', 'rio']]) {
    const [name, pre] = ch
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    out.pools[name] = await page.evaluate((p) => window.__art.pools(p + 'People'), pre)
    await shot('WOW2-' + name + '-roster', (p) => {
      const A = window.__art
      const r = A.nearest(p + 'People', true)
      return r ? A.personShot(r, 2.7, 0.35, 34, 0.5) : ''
    }, pre)
    await shot('WOW2-' + name + '-roster-front', (p) => {
      const A = window.__art
      const r = A.nearest(p + 'People', true)
      return r ? A.personShot(r, 2.4, 0.2, 34, 0.0) : ''
    }, pre)
    await shot('WOW2-' + name + '-group', (p) => window.__art.groupShot(p + 'People', 8, 9, 3.2), pre)
    await shot('WOW2-' + name + '-arrive', () => window.__art.render(window.__capy.camera))
  }

  await page.evaluate(async (o) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    await fetch('/shot?name=WOW2-people-shot.json', { method: 'POST', body: b64 })
  }, out)
}
