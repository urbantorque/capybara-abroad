async page => {
  // ART REVIEW, THIRD SHEET: llama, street dog, cow. Instanced bodies, found
  // by the instance's own height off the ground.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(9000)
  const out = { shots: [], errs }
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__art = {
      cam(px, py, pz, tx, ty, tz, fov) {
        const c = new T.PerspectiveCamera(fov || 34, 1280 / 760, 0.05, 400)
        c.position.set(px, py, pz); c.lookAt(tx, ty, tz); c.updateMatrixWorld(); return c
      },
      render(c) { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c); return g.renderer.domElement.toDataURL('image/png') },
      at(x, y, z, tx, ty, tz, fov) { return this.render(this.cam(x, y, z, tx, ty, tz, fov)) },
      inst0() {
        const rows = []
        const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
        g.scene.traverse(o => {
          if (!o.isInstancedMesh || o.count < 2 || o.count > 8) return
          o.getMatrixAt(0, m); m.decompose(p, q, s)
          const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
          let gy = p.y
          try { gy = g.pasto.terrainHeight ? g.pasto.terrainHeight(p.x, p.z) : p.y } catch (e) {}
          rows.push({ count: o.count, v: o.geometry.attributes.position.count, x: p.x, y: p.y, z: p.z, h: p.y - gy, fx: f.x, fz: f.z })
        })
        return rows
      },
      shotAt(r, dist, up, aimUp, side) {
        const ang = Math.atan2(r.fx, r.fz) + (side || 0)
        return this.at(r.x + Math.sin(ang) * dist, r.y + up, r.z + Math.cos(ang) * dist, r.x, r.y + aimUp, r.z, 34)
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
  out.inst = await page.evaluate(() => window.__art.inst0().map(r => ({ c: r.count, v: r.v, h: +r.h.toFixed(2), x: +r.x.toFixed(1), z: +r.z.toFixed(1) })))
  await shot('AR3-llama', () => {
    const A = window.__art
    const r = A.inst0().filter(r => r.h > 0.75 && r.h < 1.2 && Math.abs(r.x) < 60 && r.z > 0 && r.z < 60).sort((a, b) => b.v - a.v)[0]
    return r ? A.shotAt(r, 3.6, 1.2, -0.1, 0.8) : ''
  })
  await shot('AR3-dog', () => {
    const A = window.__art
    const r = A.inst0().filter(r => r.h > 0.3 && r.h < 0.6 && Math.abs(r.x) < 60 && r.z > 0 && r.z < 60).sort((a, b) => b.v - a.v)[0]
    return r ? A.shotAt(r, 2.4, 0.8, -0.1, 0.8) : ''
  })
  await page.evaluate(() => window.__capy.biome.switchTo('pantanal'))
  await page.waitForTimeout(8000)
  await shot('AR3-cow', () => {
    const A = window.__art, g = window.__capy
    const a = g.pantanal.herdAudit()
    const r = a.rows[0]
    if (!r || r.x === undefined) {
      const h = g.pantanal.herd()
      return A.at(h.x - 4.5, h.y + 2.4, h.z - 2.5, h.x, h.y + 0.6, h.z, 34)
    }
    const y = g.pantanal.terrainHeight ? g.pantanal.terrainHeight(r.x, r.z) : 0
    return A.at(r.x - 4.5, y + 2.4, r.z - 2.5, r.x, y + 0.6, r.z, 34)
  })
  out.herdRow = await page.evaluate(() => { const a = window.__capy.pantanal.herdAudit(); return a.rows[0] })
  await page.evaluate(async (o) => { await fetch('/shot?name=art-review3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
