async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  // the wear paths, as built (see mergeWearBand's call sites), and where to
  // stand the lens so the band is in the picture: a step along the line
  const CH = {
    sydney:  { pts: [0.0, 21.0, -0.6, 12.0, 0.2, 4.6], api: 'env' },
    rio:     { pts: [-2.0, -4.6, -22.0, -10.5, -47.0, -17.2], api: 'rio' },
    sahara:  { pts: [4, 8, 78, 14], api: 'sahara' },
    palawan: { pts: [0, 44.5, -0.5, 36.0, 0.3, 27.2], api: 'palawan' },
  }
  const out = { rows: [] }
  for (const c of Object.keys(CH)) {
    if (c !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), c); await page.waitForTimeout(9000) }
    else await page.waitForTimeout(2500)
    // walk a little way down the line so the animal is on it and the lens looks along it
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
    await page.waitForTimeout(6000)
    await page.screenshot({ path: 'qa/l6-e6-wear-' + c + '.png' })
    const row = await page.evaluate((spec) => {
      const g = window.__capy, cam = g.camera
      const api = g[spec.api] || (spec.api === 'env' ? g.env : null)
      const th = api && typeof api.terrainHeight === 'function' ? api.terrainHeight.bind(api) : null
      const V = g.scene.position.constructor
      const samples = []
      const pts = spec.pts
      for (let p = 0; p + 3 < pts.length; p += 2) {
        const x0 = pts[p], z0 = pts[p + 1], x1 = pts[p + 2], z1 = pts[p + 3]
        const len = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / len, nz = (x1 - x0) / len
        for (let t = 0.1; t < 1; t += 0.1) {
          const cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t
          const row = []
          for (const off of [-3, -2, 0, 2, 3]) {
            const x = cx + nx * off, z = cz + nz * off
            const y = th ? th(x, z) : 0
            const v = new V(x, y + 0.05, z)
            const d = v.distanceTo(cam.position)
            const q = v.clone().project(cam)
            row.push({ off, x: +x.toFixed(1), z: +z.toFixed(1), d: +d.toFixed(1), sx: Math.round((q.x + 1) * 640), sy: Math.round((1 - q.y) * 380), front: q.z < 1 })
          }
          samples.push(row)
        }
      }
      return { biome: g.biome.current, hasTh: !!th, cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
               capy: [+g.capy.body.position.x.toFixed(1), +g.capy.body.position.z.toFixed(1)], err: g.state.lastError ? String(g.state.lastError) : null, samples }
    }, CH[c])
    out.rows.push(row)
  }
  await page.evaluate((o) => fetch('/shot?name=l6-e6-wear.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
