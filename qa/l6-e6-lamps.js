async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { shots: [] }
  // where the named things are on screen, plus the extras a chapter asks for
  const where = (extra) => page.evaluate((extra) => {
    const g = window.__capy, cam = g.camera
    const V = g.scene.position.constructor
    const proj = (x, y, z) => { const v = new V(x, y, z); const d = v.distanceTo(cam.position); const p = v.clone().project(cam)
      return { x: +x.toFixed(1), y: +y.toFixed(1), z: +z.toFixed(1), d: +d.toFixed(1), sx: Math.round((p.x + 1) * 640), sy: Math.round((1 - p.y) * 380), front: p.z < 1 } }
    const named = []
    const names = { hkTaxi: 1, iceCar: 1, monYacht: 1, monCar: 1 }
    const v = new V()
    g.scene.traverse((o) => { if (!names[o.name]) return; o.getWorldPosition(v); named.push(Object.assign({ name: o.name }, proj(v.x, v.y, v.z))) })
    const r = { biome: g.biome.current, err: g.state.lastError ? String(g.state.lastError) : null,
                cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)], named }
    if (extra === 'kowloon') {
      r.parked = [[-5.2, 30], [5.0, 12], [-5.2, -18]].map(([x, z]) => Object.assign({ name: 'hkParked' }, proj(x, 0.7, z)))
    }
    if (extra === 'iceland') {
      // the window pools: the additive glow mesh under the iceland root; each disc is 384 vertices and its first is the centre
      const root = g.scene.children.find(c => c.name === 'iceland') || null
      const pools = []
      if (root) root.traverse((o) => {
        if (!o.isMesh || !o.material || o.material.blending !== 2 || !o.material.vertexColors || o.parent.name === 'iceCar') return
        const pa = o.geometry.attributes.position, ca = o.geometry.attributes.color
        if (!pa || pa.count % 384 !== 0) return
        for (let k = 0; k < pa.count / 384; k++) {
          const i = k * 384
          const cr = ca.getX(i), cg = ca.getY(i)
          // a window pool's centre is iceWindow x 0.18: r ~0.173; a sodium pool's is ~0.54
          if (cr > 0.3) continue
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i)
          pools.push({ at: proj(x, y, z), plus: proj(x + 5, y, z), minus: proj(x - 5, y, z) })
        }
      })
      r.pools = pools
    }
    if (extra === 'monaco') {
      const y = g.scene.children.find(c => c.name === 'monaco')
      let yg = null; if (y) y.traverse((o) => { if (o.name === 'monYacht') yg = o })
      if (yg) {
        const p = yg.position, wy = 3.4 + 1.6, L = 42, B = 8.6
        r.cabin = [[-B / 2, wy - 1, -2 - L * 0.21], [B / 2, wy - 1, -2 - L * 0.21], [-B / 2, wy + 1, -2 + L * 0.21], [B / 2, wy + 1, -2 + L * 0.21],
                   [-B / 2 + 1.9, 6.2 + 2.2, -4 - L * 0.13], [B / 2 - 1.9, 6.2 + 2.2, -4 + L * 0.13]].map(([x, yy, z]) => proj(p.x + x, yy, p.z + z))
      }
    }
    return r
  }, extra)
  // ---- Kowloon: wait for the moving taxi to be in front and near ----------
  await page.evaluate(() => window.__capy.hud.cross('kowloon'))
  await page.waitForTimeout(9000)
  let got = false
  for (let i = 0; i < 50 && !got; i++) {
    const w = await where('kowloon')
    const t = w.named.find(n => n.name === 'hkTaxi')
    if (t && t.front && t.d < 30 && t.sx > 60 && t.sx < 1220 && t.sy > 40 && t.sy < 700) {
      await page.screenshot({ path: 'qa/l6-e6-lamps-kowloon-taxi.png' })
      out.shots.push(Object.assign({ shot: 'kowloon-taxi' }, await where('kowloon')))
      got = true
    } else await page.waitForTimeout(500)
  }
  await page.screenshot({ path: 'qa/l6-e6-lamps-kowloon-arrive.png' })
  out.shots.push(Object.assign({ shot: 'kowloon-arrive' }, await where('kowloon')))
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
  await page.waitForTimeout(14000)
  await page.screenshot({ path: 'qa/l6-e6-lamps-kowloon-rest.png' })
  out.shots.push(Object.assign({ shot: 'kowloon-rest' }, await where('kowloon')))
  // ---- Iceland: the walking lens, and the car when it passes -------------
  await page.evaluate(() => window.__capy.hud.cross('iceland'))
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/l6-e6-lamps-iceland-arrive.png' })
  out.shots.push(Object.assign({ shot: 'iceland-arrive' }, await where('iceland')))
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'qa/l6-e6-lamps-iceland-walk.png' })
  out.shots.push(Object.assign({ shot: 'iceland-walk' }, await where('iceland')))
  got = false
  for (let i = 0; i < 40 && !got; i++) {
    const w = await where('iceland')
    const t = w.named.find(n => n.name === 'iceCar')
    if (t && t.front && t.d < 30 && t.sx > 60 && t.sx < 1220 && t.sy > 40 && t.sy < 700) {
      await page.screenshot({ path: 'qa/l6-e6-lamps-iceland-car.png' })
      out.shots.push(Object.assign({ shot: 'iceland-car' }, await where('iceland')))
      got = true
    } else await page.waitForTimeout(500)
  }
  // ---- Monaco: the arrival, looking at the yacht --------------------------
  await page.evaluate(() => window.__capy.hud.cross('monaco'))
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/l6-e6-lamps-monaco-arrive.png' })
  out.shots.push(Object.assign({ shot: 'monaco-arrive' }, await where('monaco')))
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
  await page.waitForTimeout(14000)
  await page.screenshot({ path: 'qa/l6-e6-lamps-monaco-rest.png' })
  out.shots.push(Object.assign({ shot: 'monaco-rest' }, await where('monaco')))
  await page.evaluate((o) => fetch('/shot?name=l6-e6-lamps.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
