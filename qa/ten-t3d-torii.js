async page => {
  // T3d, noToriiWood: the run's own framing pinned at gates 5, 20 and 35 — the animal on the
  // gate, the lens 6 m back down the path and 2.6 m over it (under the rail's 3.3 ceiling),
  // looking 8 m up the path — rendered live, cut and at rung 1 in one evaluate (prefs pf 1
  // pins the governor at rung 0). The mask is the screen box between the inner faces of the
  // legs of the gate two ahead of the animal, from the path up to its nuki; 'lawn' is a pixel whose green leads red and blue by 14/255
  // and whose luminance is over 0.30, which the dark wood (kyoUnder, sugiDeep, sugiBark) and
  // the haze are not. Raw renders to the /shot sink; fresh session after any kyoto.js edit.
  const CH = 'kyoto', NAME = 'ten-t3d-torii'
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome.current === 'kyoto'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:5194/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === CH) break
      await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
      await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const shots = []
  for (const k of [5, 20, 35]) for (const tag of ['live', 'cut', 'rung1']) shots.push([k, tag])
  for (const [k, tag] of shots) {
    out['g' + k + '-' + tag] = await page.evaluate(async o => {
      const g = window.__capy, THREE = g.THREE, b = g.capy.body, K = g.kyoto
      const keep = { noToriiWood: g.state.noToriiWood, perfRung: g.state.perfRung }
      const st = o.tag === 'cut' ? { noToriiWood: true, perfRung: 0 } : o.tag === 'rung1' ? { noToriiWood: false, perfRung: 1 } : { noToriiWood: false, perfRung: 0 }
      const P = K.toriiPath(), k = o.k
      const gx = i => P[i * 2], gz = i => P[i * 2 + 1]
      const ax = gx(k), az = gz(k)
      Object.assign(g.state, st)
      for (let i = 0; i < 20; i++) { b.position.set(ax, K.terrainHeight(ax, az) + 0.6, az); b.velocity.set(0, 0, 0); g.tick(1 / 60, false) }
      Object.assign(g.state, st)
      g.tick(1 / 60, false)
      // the lens: 6 m back down the path from gate k, 2.6 m over it
      const dx = gx(k + 1) - gx(k - 1), dz = gz(k + 1) - gz(k - 1), dl = Math.hypot(dx, dz)
      const cx = gx(k) - dx / dl * 6, cz = gz(k) - dz / dl * 6
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
      g.camera.position.set(cx, K.terrainHeight(cx, cz) + 2.6, cz)
      const lx = gx(k) + dx / dl * 2, lz = gz(k) + dz / dl * 2
      g.camera.lookAt(new THREE.Vector3(lx, K.terrainHeight(lx, lz) + 1.2, lz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const c = g.renderer.domElement, t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      const x2 = t.getContext('2d'); x2.drawImage(c, 0, 0)
      const d = x2.getImageData(0, 0, t.width, t.height).data
      // the mask: gate k+2's legs (2.5 m out, 0.3 m radius) and its nuki (4.0 - 0.75 m up)
      const nx = gx(k + 3) - gx(k + 1), nz = gz(k + 3) - gz(k + 1), yaw = Math.atan2(nx, nz)
      const cs = Math.cos(yaw), sn = Math.sin(yaw), mx = gx(k + 2), mz = gz(k + 2), my = K.terrainHeight(mx, mz)
      const pr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(g.camera); return [(v.x + 1) * 0.5 * t.width, (1 - v.y) * 0.5 * t.height] }
      const L = pr(mx - cs * 2.2, my + 0.1, mz + sn * 2.2), R = pr(mx + cs * 2.2, my + 0.1, mz - sn * 2.2)
      const T = pr(mx, my + 3.25, mz)
      const x0 = Math.max(0, Math.round(Math.min(L[0], R[0]))), x1 = Math.min(t.width, Math.round(Math.max(L[0], R[0])))
      const y0 = Math.max(0, Math.round(T[1])), y1 = Math.min(t.height, Math.round(Math.max(L[1], R[1])))
      let n = 0, lawn = 0, dark = 0, fl = 0
      const isLawn = i => { const r = d[i], gg = d[i + 1], bb = d[i + 2]; return gg - Math.max(r, bb) > 14 && (0.2126 * r + 0.7152 * gg + 0.0722 * bb) / 255 > 0.30 }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * t.width + x) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2]
        const lum = (0.2126 * r + 0.7152 * gg + 0.0722 * bb) / 255
        n++
        if (isLawn(i)) lawn++
        if (lum < 0.22) dark++
      }
      for (let i = 0; i < d.length; i += 4) if (isLawn(i)) fl++
      const png = c.toDataURL('image/png')
      await fetch('/shot?name=' + o.name, { method: 'POST', body: png.split(',')[1] })
      const res = { box: [x0, y0, x1, y1], n, lawn: +(lawn / Math.max(1, n)).toFixed(4), frameLawn: +(fl / (d.length / 4)).toFixed(4), dark: +(dark / Math.max(1, n)).toFixed(4),
        wood: K.toriiWood ? K.toriiWood() : null }
      Object.assign(g.state, keep)
      return res
    }, { k, tag, name: NAME + '-g' + k + '-' + tag })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
