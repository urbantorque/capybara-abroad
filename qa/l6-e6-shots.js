async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, rows: [] }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  // per frame: draw calls, the error, and where the named emitters are on screen
  // (px from the top-left of a 1280x760 frame) with their distance from the lens
  const info = async (t) => page.evaluate((t) => {
    const g = window.__capy, r = g.renderer, cam = g.camera
    r.info.autoReset = false; r.info.reset()
    return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = r.info.render.calls, tri = r.info.render.triangles
      r.info.autoReset = true
      const named = []
      const v = new (g.scene.position.constructor)()
      const names = { hkTaxi: 1, iceCar: 1, monYacht: 1, monCar: 1 }
      g.scene.traverse((o) => {
        if (!names[o.name]) return
        o.getWorldPosition(v)
        const d = v.distanceTo(cam.position)
        const p = v.clone().project(cam)
        named.push({ name: o.name, x: +v.x.toFixed(1), y: +v.y.toFixed(1), z: +v.z.toFixed(1), d: +d.toFixed(1),
                     sx: Math.round((p.x + 1) * 640), sy: Math.round((1 - p.y) * 380), front: p.z < 1 })
      })
      // the parked Kowloon taxis, by their rows
      if (g.biome.current === 'kowloon') {
        for (const [x, z] of [[-5.2, 30], [5.0, 12], [-5.2, -18]]) {
          v.set(x, 0.7, z)
          const d = v.distanceTo(cam.position)
          const p = v.clone().project(cam)
          named.push({ name: 'hkParked', x, y: 0.7, z, d: +d.toFixed(1), sx: Math.round((p.x + 1) * 640), sy: Math.round((1 - p.y) * 380), front: p.z < 1 })
        }
      }
      res({ tag: t, biome: g.biome.current, calls: c, tris: tri, err: g.state.lastError ? String(g.state.lastError) : null,
            cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
            capy: [+g.capy.body.position.x.toFixed(1), +g.capy.body.position.y.toFixed(1), +g.capy.body.position.z.toFixed(1)],
            named })
    })))
  }, t)
  const CH = ['sydney', 'rio', 'sahara', 'palawan', 'kowloon', 'iceland', 'monaco', 'hanoi']
  for (const c of CH) {
    if (c !== 'sydney') {
      await page.evaluate((c) => window.__capy.hud.cross(c), c)
      await page.waitForTimeout(9000)
    } else await page.waitForTimeout(2500)
    await page.screenshot({ path: 'qa/l6-e6-' + c + '-arrive.png' })
    out.rows.push(await info('arrive'))
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3200)
    await page.screenshot({ path: 'qa/l6-e6-' + c + '-walk.png' })
    out.rows.push(await info('walk'))
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    await page.screenshot({ path: 'qa/l6-e6-' + c + '-rest.png' })
    out.rows.push(await info('rest'))
  }
  await page.evaluate((o) => fetch('/shot?name=l6-e6-shots.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
