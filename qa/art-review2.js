async page => {
  // ART REVIEW, SECOND SHEET: the gait, the hop, the beasts, the herd, the bird.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
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
        c.position.set(px, py, pz); c.lookAt(tx, ty, tz); c.updateMatrixWorld(); return c
      },
      render(c) { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c); return g.renderer.domElement.toDataURL('image/png') },
      capyShot(yawOff, dist, up, aimY, aimFwd, fov) {
        const p = g.capy.position
        const my = (g.capy.model || g.capy.group).rotation.y
        const fx = Math.sin(my), fz = Math.cos(my)
        const ax = p.x + fx * (aimFwd || 0), az = p.z + fz * (aimFwd || 0), ay = p.y + (aimY || 0)
        const yaw = my + yawOff
        return this.render(this.cam(ax + Math.sin(yaw) * dist, ay + up, az + Math.cos(yaw) * dist, ax, ay, az, fov))
      },
      at(x, y, z, tx, ty, tz, fov) { return this.render(this.cam(x, y, z, tx, ty, tz, fov)) },
      put(x, y, z) {
        const b = g.capy.body
        b.position.set(x, y, z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      },
      beasts() {
        const res = []
        g.scene.traverse(o => {
          if (o.type !== 'Group' || o.children.length !== 5) return
          const b = o.children[0]
          if (!b || b.children.length !== 2 || o.children.some(c => c.isMesh)) return
          if (b.position.y > 0.3 && b.position.y < 1.0) res.push({ x: o.position.x, y: o.position.y, z: o.position.z, ry: o.rotation.y, by: b.position.y })
        })
        return res
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
  const go = async (name) => { await page.evaluate((n) => window.__capy.biome.switchTo(n), name); await page.waitForTimeout(8000) }

  // ---- gait: open lawn, run away from the lens ----------------------------
  await page.evaluate(() => window.__art.put(30, 0.6, 30))
  await page.waitForTimeout(1500)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(900)
  await shot('AR2-capy-walk', () => window.__art.capyShot(Math.PI / 2 + 0.25, 3.4, 0.7, 0.3, 0.0))
  await page.keyboard.down('ShiftLeft')
  await page.waitForTimeout(1200)
  await shot('AR2-capy-run', () => window.__art.capyShot(Math.PI / 2 + 0.25, 3.6, 0.7, 0.3, 0.0))
  await shot('AR2-capy-run-3q', () => window.__art.capyShot(0.8, 3.4, 0.9, 0.3, 0.1))
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW')
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__art.put(30, 0.6, 30))
  await page.waitForTimeout(1200)
  await page.keyboard.down('Space'); await page.waitForTimeout(60); await page.keyboard.up('Space')
  await page.waitForTimeout(260)
  await shot('AR2-capy-hop', () => window.__art.capyShot(Math.PI / 2 + 0.4, 3.8, 0.4, 0.6, 0.0))
  await page.waitForTimeout(1500)
  await shot('AR2-capy-stand-3q', () => window.__art.capyShot(0.75, 3.0, 0.75, 0.25, 0.1))
  await shot('AR2-capy-stand-side', () => window.__art.capyShot(Math.PI / 2, 3.2, 0.5, 0.28, 0.0))
  // the ibis: count 6, 144 verts
  await shot('AR2-ibis', () => {
    const A = window.__art, g = window.__capy, T = g.THREE
    let ib = null
    g.scene.traverse(o => { if (!ib && o.isInstancedMesh && o.count === 6 && o.geometry.attributes.position.count === 144) ib = o })
    if (!ib) return ''
    const m = new T.Matrix4(), p = new T.Vector3(); ib.getMatrixAt(0, m); p.setFromMatrixPosition(m)
    return A.at(p.x + 1.5, p.y + 0.9, p.z + 1.5, p.x, p.y + 0.1, p.z, 34)
  })

  // ---- pasto: llama and dog ------------------------------------------------
  await go('pasto')
  out.beasts = await page.evaluate(() => window.__art.beasts())
  await shot('AR2-llama', () => {
    const A = window.__art; const b = A.beasts().filter(r => r.by > 0.7)[0]
    if (!b) return ''
    const ang = b.ry + 0.8
    return A.at(b.x + Math.sin(ang) * 3.4, b.y + 1.7, b.z + Math.cos(ang) * 3.4, b.x, b.y + 0.8, b.z, 34)
  })
  await shot('AR2-dog', () => {
    const A = window.__art; const b = A.beasts().filter(r => r.by < 0.7)[0]
    if (!b) return ''
    const ang = b.ry + 0.8
    return A.at(b.x + Math.sin(ang) * 2.2, b.y + 1.0, b.z + Math.cos(ang) * 2.2, b.x, b.y + 0.35, b.z, 34)
  })

  // ---- pantanal: the herd, close ------------------------------------------
  await go('pantanal')
  await shot('AR2-herd', () => {
    const A = window.__art, g = window.__capy
    const h = g.pantanal.herd()
    const c = g.capy.position
    const ang = Math.atan2(c.x - h.x, c.z - h.z)
    return A.at(h.x + Math.sin(ang + 0.7) * 5.5, h.y + 2.2, h.z + Math.cos(ang + 0.7) * 5.5, h.x, h.y + 0.5, h.z, 34)
  })
  out.herd = await page.evaluate(() => { const a = window.__capy.pantanal.herdAudit(); return { n: a.rows.length, kinds: a.rows.map(r => r.kind || r.id).slice(0, 8) } })

  // ---- the condor, summoned -------------------------------------------------
  await go('pasto')
  await page.evaluate(() => { const g = window.__capy; g.condor.summon() })
  await page.waitForTimeout(6000)
  out.condor = await page.evaluate(() => { const c = window.__capy.condor; return { state: c.state, active: c.active, has: !!c.group } })
  await shot('AR2-condor', () => {
    const A = window.__art, g = window.__capy
    const c = g.condor; if (!c.group) return ''
    const p = new g.THREE.Vector3(); c.group.getWorldPosition(p)
    return A.at(p.x + 4.5, p.y + 2.5, p.z + 4.5, p.x, p.y, p.z, 34)
  })
  await shot('AR2-condor-above', () => {
    const A = window.__art, g = window.__capy
    const c = g.condor; if (!c.group) return ''
    const p = new g.THREE.Vector3(); c.group.getWorldPosition(p)
    return A.at(p.x + 0.5, p.y + 7.5, p.z + 3.0, p.x, p.y, p.z, 34)
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=art-review2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
