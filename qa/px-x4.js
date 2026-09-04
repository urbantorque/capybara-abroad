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
      slipAt(x, z) { const a = this.api(); return (a && a.groundSlip) ? a.groundSlip(x, z) : 0 },
      place(x, z, dy) {
        const s = window.__x4
        b.position.set(x, s.th(x, z) + (dy === undefined ? 0.5 : dy), z)
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        s.sx = 0; s.sz = 0; s.run = false; s.T(24)
      },
      spd() { return Math.hypot(b.velocity.x, b.velocity.z) }
    }
    return true
  }

  // ---- A. speed on a surface, same held key -------------------------------
  const SURF = (spec) => {
    const g = window.__capy, b = g.capy.body, s = window.__x4
    const res = []
    for (const t of spec) {
      // find a point: scan for the requested slip band, else use the given xz
      // FIND A FLAT POINT, not just a slippery one. The first cut of this took
      // any cell in the slip band and landed on 24-degree slopes, where the
      // animal is sliding before the key is even pressed and "walk speed" means
      // nothing.
      let px = t.x, pz = t.z
      if (t.slipMin !== undefined) {
        let best = null, bd = 9
        const R = t.far ? 320 : 140
        for (let a = -R; a <= R; a += 10) for (let c = -R; c <= R; c += 10) {
          const sl = s.slipAt(a, c)
          if (sl < t.slipMin || sl > t.slipMax) continue
          const h = s.th(a, c); if (!(h === h)) continue
          const gx = (s.th(a + 2, c) - s.th(a - 2, c)) / 4
          const gz = (s.th(a, c + 2) - s.th(a, c - 2)) / 4
          const gr = Math.hypot(gx, gz)
          if (gr > (t.maxGrade === undefined ? 0.06 : t.maxGrade)) continue
          const d = Math.abs(sl - (t.slipMin + t.slipMax) / 2) + gr
          if (d < bd) { bd = d; best = [a, c] }
        }
        if (best) { px = best[0]; pz = best[1] }
        else { res.push({ tag: t.tag, none: true }); continue }
      }
      const row = { tag: t.tag, x: px, z: pz, slip: +s.slipAt(px, pz).toFixed(2) }
      // HOLD FOR 1.2 s AND TAKE THE PEAK, not 3 s and the final value. At
      // capyACCEL 55 the top speed is reached in about 0.2 s, so a short hold
      // is enough — and three seconds of travel is twelve to twenty-two metres,
      // which walked the animal into the harbour and reported a RUN slower than
      // a WALK on flat Sydney paving.
      const leg = (run) => {
        s.place(px, pz)
        s.sx = 1; s.sz = 0; s.run = run
        let peak = 0, bad = 0
        for (let i = 0; i < 72; i++) {
          s.T(1)
          if (g.capy.swimming || !g.capy.grounded) { bad++; continue }
          const v = s.spd(); if (v > peak) peak = v
        }
        s.sx = 0; s.sz = 0; s.run = false
        return { v: +peak.toFixed(2), bad }
      }
      const w = leg(false), r2 = leg(true)
      row.walk = w.v; row.walkBad = w.bad
      row.run = r2.v; row.runBad = r2.bad
      s.place(px, pz)
      row.grade = +(g.capy.grade || 0).toFixed(2)
      res.push(row)
    }
    return res
  }

  // ---- B. launch() keeps its horizontal -----------------------------------
  const LAUNCH = () => {
    const g = window.__capy, b = g.capy.body, s = window.__x4
    s.place(0, 22)
    const x0 = b.position.x, z0 = b.position.z
    g.capy.launch(3.0, 8.0, 0)
    const v0 = Math.hypot(b.velocity.x, b.velocity.z)
    let f5 = null, peakY = b.position.y, t = 0
    for (let i = 0; i < 240; i++) {
      s.T(1); t += 1 / 60
      if (i === 4) f5 = +Math.hypot(b.velocity.x, b.velocity.z).toFixed(2)
      if (b.position.y > peakY) peakY = b.position.y
      if (i > 12 && g.capy.grounded) break
    }
    return { v0: +v0.toFixed(2), v5: f5, airtime: +t.toFixed(2),
             drift: +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(2),
             apex: +(peakY - s.th(x0, z0)).toFixed(2) }
  }

  // ---- C. the storm --------------------------------------------------------
  // Marrakech's storm is phase-driven and api.storm() is a getter with no
  // setter, so this reproduces the storm's own CALL PATTERN instead of waiting
  // for its weather: sahara.js does `capy.shove(-sahWIND_F * storm * dt, ...)`
  // every frame at sahWIND_F 6.2. Same arithmetic, deterministic, and it
  // isolates the channel from everything else in that chapter.
  const STORM = (F) => {
    const g = window.__capy, b = g.capy.body, s = window.__x4
    const r = { windF: F, storm: g.sahara && g.sahara.storm ? +g.sahara.storm().toFixed(2) : null }
    const blow = (k) => {
      for (let i = 0; i < k; i++) {
        g.capy.shove(-F * (1 / 60), Math.sin(i * 0.03) * F * (1 / 60) * 0.4)
        s.T(1)
      }
    }
    s.place(200, -60); blow(120)
    const x0 = b.position.x, z0 = b.position.z
    blow(120)
    r.standDrift2s = +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(2)
    r.standSpeed = +s.spd().toFixed(2)
    // ...and a standing hop in the same wind
    s.place(200, -60); blow(60)
    const hx = b.position.x, hz = b.position.z
    g.input.jump = true; g.input.jumpPressed = true
    g.capy.shove(-F * (1 / 60), 0); g.tick(1 / 60, false)
    g.input.jumpPressed = false
    let peak = 0, tt = 0
    for (let i = 0; i < 300; i++) {
      g.capy.shove(-F * (1 / 60), 0)
      s.T(1); tt += 1 / 60
      const sp = Math.hypot(b.velocity.x, b.velocity.z)
      if (sp > peak) peak = sp
      if (i > 10 && g.capy.grounded) break
    }
    g.input.jump = false
    r.hopPeakSpeed = +peak.toFixed(2)
    r.hopDist = +Math.hypot(b.position.x - hx, b.position.z - hz).toFixed(2)
    r.hopAir = +tt.toFixed(2)
    return r
  }

  const sw = async (n) => {
    await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, n)
    await page.waitForTimeout(3600)
    await page.evaluate(BOOT)
  }

  try {
    await sw('sydney')
    out.sydney = await page.evaluate(SURF, [{ tag: 'paving', x: 0, z: 22 }])
    out.launch = await page.evaluate(LAUNCH)
    await sw('antarctic')
    out.antarctic = await page.evaluate(SURF, [
      { tag: 'snow', slipMin: 0.10, slipMax: 0.30 },
      { tag: 'blue ice', slipMin: 0.70, slipMax: 1.01 }])
    await sw('iceland')
    out.iceland = await page.evaluate(SURF, [{ tag: 'glacier', slipMin: 0.70, slipMax: 1.01 }])
    await sw('monaco')
    out.monaco = await page.evaluate(SURF, [{ tag: 'marble', slipMin: 0.20, slipMax: 0.45 }])
    await sw('sahara')
    out.sahara = await page.evaluate(SURF, [{ tag: 'dune', slipMin: 0.50, slipMax: 1.01, far: true }])
    out.storm = await page.evaluate(STORM, 6.2)
    out.storm25 = await page.evaluate(STORM, 2.5)
  } catch (e) { out.fatal = String(e).slice(0, 300) }

  await page.evaluate(o => fetch('/shot?name=px-x4.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
