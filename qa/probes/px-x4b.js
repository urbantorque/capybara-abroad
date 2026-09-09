async page => {
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const BOOT = () => {
    const g = window.__capy, b = g.capy.body, inp = g.input
    window.__x4 = {
      sx: 0, sz: 0, run: false,
      T(k) {
        const s = window.__x4
        for (let i = 0; i < k; i++) {
          inp.x = s.sx; inp.z = s.sz; inp.run = s.run; inp.camYaw = 0
          inp.jump = false; inp.jumpPressed = false
          g.tick(1 / 60, false)
        }
      },
      api() { const n = g.biome.current; return n === 'sydney' ? g.env : g[n] },
      th(x, z) { const a = this.api(); return (a && a.terrainHeight) ? a.terrainHeight(x, z) : 0 },
      ow(x, z) { const a = this.api(); return !!(a && a.isOverWater && a.isOverWater(x, z)) },
      slipAt(x, z) { const a = this.api(); return (a && a.groundSlip) ? a.groundSlip(x, z) : 0 },
      place(x, z) {
        const s = window.__x4
        b.position.set(x, s.th(x, z) + 0.5, z)
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        s.sx = 0; s.sz = 0; s.run = false; s.T(30)
      },
      spd() { return Math.hypot(b.velocity.x, b.velocity.z) }
    }
    return true
  }

  // Walk ACROSS the fall line, not down it, so gravity is not part of the
  // answer: pick the direction perpendicular to the local gradient.
  const SURF = (t) => {
    const g = window.__capy, b = g.capy.body, s = window.__x4
    const R = t.far ? 320 : 150
    let best = null, bd = 9
    for (let a = -R; a <= R; a += 8) for (let c = -R; c <= R; c += 8) {
      const sl = s.slipAt(a, c)
      if (sl < t.slipMin || sl > t.slipMax) continue
      if (s.ow(a, c)) continue
      const h = s.th(a, c); if (!(h === h)) continue
      const gx = (s.th(a + 2, c) - s.th(a - 2, c)) / 4
      const gz = (s.th(a, c + 2) - s.th(a, c - 2)) / 4
      const gr = Math.hypot(gx, gz)
      if (gr > t.maxGrade) continue
      const d = Math.abs(sl - (t.slipMin + t.slipMax) / 2) + gr * 2
      if (d < bd) { bd = d; best = [a, c, gr, gx, gz] }
    }
    if (!best) return { tag: t.tag, none: true }
    const [px, pz, gr, gx, gz] = best
    // across the slope
    let ux = -gz, uz = gx
    const ul = Math.hypot(ux, uz)
    if (ul < 1e-4) { ux = 1; uz = 0 } else { ux /= ul; uz /= ul }
    const row = { tag: t.tag, x: px, z: pz, slip: +s.slipAt(px, pz).toFixed(2), terrGrade: +gr.toFixed(3) }
    const leg = (run, sx, sz) => {
      s.place(px, pz)
      s.sx = sx; s.sz = sz; s.run = run
      let peak = 0, bad = 0
      for (let i = 0; i < 72; i++) {
        s.T(1)
        if (g.capy.swimming || !g.capy.grounded) { bad++; continue }
        const v = s.spd(); if (v > peak) peak = v
      }
      s.sx = 0; s.sz = 0; s.run = false
      return { v: +peak.toFixed(2), bad }
    }
    const w = leg(false, ux, uz), r = leg(true, ux, uz)
    row.walk = w.v; row.walkBad = w.bad
    row.run = r.v; row.runBad = r.bad
    // ...and straight UP the fall line at a run, which is the glacier case
    if (gr > 0.05) {
      const nl = Math.hypot(gx, gz)
      const up = leg(true, gx / nl, gz / nl)
      row.runUphill = up.v; row.runUphillBad = up.bad
    }
    return row
  }

  const sw = async (n) => {
    await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, n)
    await page.waitForTimeout(3600)
    await page.evaluate(BOOT)
  }

  try {
    await sw('antarctic')
    out.blueice = await page.evaluate(SURF, { tag: 'blue ice', slipMin: 0.65, slipMax: 1.01, maxGrade: 0.20 })
    await sw('iceland')
    out.glacier = await page.evaluate(SURF, { tag: 'glacier', slipMin: 0.65, slipMax: 1.01, maxGrade: 0.40 })
    await sw('monaco')
    out.marble = await page.evaluate(SURF, { tag: 'marble', slipMin: 0.20, slipMax: 0.45, maxGrade: 0.05 })
    await sw('sahara')
    out.dune = await page.evaluate(SURF, { tag: 'dune', slipMin: 0.45, slipMax: 1.01, maxGrade: 0.30, far: true })
  } catch (e) { out.fatal = String(e).slice(0, 300) }

  await page.evaluate(o => fetch('/shot?name=px-x4b.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
