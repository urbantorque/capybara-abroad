async page => {
  // D1: DID THE SKY GAIN A DIRECTION?
  //
  // Read off the dome's own vertex colours rather than off a rendered frame,
  // because at the resting 41-degree pitch the sky is a strip at the top of the
  // picture and a frame mean cannot tell a lobe from a cloud. Every vertex knows
  // its own unit direction, so "brighter toward the sun" and "a band at the
  // horizon" are both arithmetic on the array the paint just wrote.
  //
  // TWO TRAPS, both paid for once. The dome is 32 x 18, so its rings sit at ten
  // degrees of POLAR angle: y = 1, 0.985, 0.940, ... 0.174, 0. There is nothing
  // at all between y = 0 and y = 0.174, so a band sampled at "0.02 < y < 0.06"
  // reads no vertices and reports null rather than nothing. And the lobe has to
  // be compared AT THE SUN'S OWN ELEVATION — sampling a band low in the sky and
  // calling the difference a lobe measures the vertical ramp instead.
  //
  // Four chapters (sydney, drift, goreme, cave) carry their own sky and are not
  // in this list for that reason.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [], errs: [] }
  const KEYS = ['Digit4', 'Digit6', 'Digit0', 'Digit8', 'BracketRight']
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const row = await page.evaluate(() => {
      const g = window.__capy
      let sky = null, sun = null
      g.scene.traverse(o => {
        if (!sky && o.isMesh && o.renderOrder === -20 && o.material && o.material.vertexColors) sky = o
        if (!sun && o.isDirectionalLight && o.castShadow) sun = o
      })
      if (!sky) return { biome: g.biome.current, ownSky: true }
      const pos = sky.geometry.attributes.position, col = sky.geometry.attributes.color
      const R = Math.hypot(pos.getX(0), pos.getY(0), pos.getZ(0))
      const d = sun.position.clone().sub(sun.target.position).normalize()
      const L = (i) => 0.299 * col.getX(i) + 0.587 * col.getY(i) + 0.114 * col.getZ(i)
      const acc = { tN: 0, tS: 0, aN: 0, aS: 0, bN: 0, bS: 0, mN: 0, mS: 0 }
      const rings = {}
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / R
        const key = Math.round(y * 1000) / 1000
        rings[key] = (rings[key] || 0) + 1
        if (y < -0.001) continue
        const dot = (pos.getX(i) / R) * d.x + y * d.y + (pos.getZ(i) / R) * d.z
        if (Math.abs(y - d.y) < 0.13) {
          if (dot > 0.80) { acc.tN++; acc.tS += L(i) }
          else if (dot < 0.10) { acc.aN++; acc.aS += L(i) }
        }
        if (y < 0.02) { acc.bN++; acc.bS += L(i) }
        else if (y > 0.30 && y < 0.50) { acc.mN++; acc.mS += L(i) }
      }
      const r3 = (v) => Math.round(v * 1000) / 1000
      const T = acc.tN ? acc.tS / acc.tN : null, A = acc.aN ? acc.aS / acc.aN : null;
      const B = acc.bN ? acc.bS / acc.bN : null, M = acc.mN ? acc.mS / acc.mN : null;
      return { biome: g.biome.current, verts: pos.count,
               sunY: Math.round(d.y * 100) / 100,
               rings: Object.keys(rings).map(Number).sort((a, b) => a - b).slice(0, 4),
               towardSun: T && r3(T), awaySun: A && r3(A),
               lobeGain: (T !== null && A !== null) ? r3(T - A) : null,
               horizon: B && r3(B), mid: M && r3(M),
               bandGain: (B !== null && M !== null) ? r3(B - M) : null }
    })
    out.rows.push(Object.assign({ key: key }, row))
  }
  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d1-sky.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
