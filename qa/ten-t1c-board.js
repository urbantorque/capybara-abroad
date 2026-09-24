async page => {
  const TAG = 'ten-t1c-board-' + Date.now()
  const RUNS = 3
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const out = { runs: [] }
  const post = o => page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out: o })
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
  const held = new Set()
  const setKeys = async want => {
    for (const k of keys) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k) }
      if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k) }
    }
  }
  const snap = () => page.evaluate(() => {
    const g = window.__capy, G = g.goreme, p = g.capy.position
    const b = G.balloon(), bx = b.x, by = b.y, bz = b.z
    const t = G.truck(), tx = t.x, tz = t.z
    const h = g.hintTarget('aboard')
    return { t: +g.state.time.toFixed(1), biome: g.biome.current, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
      yaw: g.input.camYaw, bal: [+bx.toFixed(2), +by.toFixed(2), +bz.toFixed(2)], truck: [+tx.toFixed(2), +tz.toFixed(2)],
      truckToBasket: +Math.hypot(tx - bx, tz - bz).toFixed(2), hint: h ? [+h.x.toFixed(2), +h.z.toFixed(2)] : null,
      aboard: G.aboard(), rung: g.state.perfRung, err: g.state.lastError || null }
  })
  for (let run = 0; run < RUNS; run++) {
    const r = { run, samples: [] }
    await page.goto('http://localhost:5193/', { waitUntil: 'commit', timeout: 120000 })
    await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 })
    await page.waitForTimeout(2500)
    await page.evaluate(() => document.querySelector('.capyui-go').click())
    await page.waitForTimeout(5000)
    // a fresh story file has one place open; the truck does not care which mode
    await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('goreme') })
    await page.waitForFunction(() => window.__capy.biome.current === 'goreme', null, { timeout: 30000 })
    await page.waitForTimeout(6000)
    r.arrive = await snap()
    // walk to the hint, closed loop on the camera yaw
    const t0 = Date.now()
    let s = r.arrive
    // a player walks round what is in the way: the field's own cold envelope
    // lies across the plaza-to-basket line on some dawns (run 1 of the first
    // batch sat in its mouth for 70 s). No progress for 2.5 s -> back off and
    // sidestep, and count it.
    r.unstick = 0
    let lastP = null, lastT = Date.now()
    while (Date.now() - t0 < 70000) {
      s = await snap()
      if (!s.hint) break
      const dx = s.hint[0] - s.x, dz = s.hint[1] - s.z
      const d = Math.hypot(dx, dz)
      if (d < 3.2) break
      if (!lastP || Math.hypot(s.x - lastP[0], s.z - lastP[1]) > 0.6) { lastP = [s.x, s.z]; lastT = Date.now() }
      else if (Date.now() - lastT > 2500) {
        r.unstick++
        await setKeys(new Set(['KeyS'])); await page.waitForTimeout(900)
        await setKeys(new Set([r.unstick % 2 ? 'KeyD' : 'KeyA'])); await page.waitForTimeout(1800)
        await setKeys(new Set(['KeyW'])); await page.waitForTimeout(900)
        lastP = null; continue
      }
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw)
      const f = (dx * fx + dz * fz) / d, rr = (dx * rx + dz * rz) / d
      const want = new Set()
      if (f > 0.38) want.add('KeyW'); if (f < -0.38) want.add('KeyS')
      if (rr > 0.38) want.add('KeyD'); if (rr < -0.38) want.add('KeyA')
      await setKeys(want)
      if ((Date.now() - t0) % 5000 < 260) r.samples.push(s)
      await page.waitForTimeout(220)
    }
    await setKeys(new Set())
    r.walkS = +((Date.now() - t0) / 1000).toFixed(1)
    r.atHint = await snap()
    // hop in: keep steering at the basket centre and hop every second
    const t1 = Date.now()
    r.aboardS = null
    while (Date.now() - t1 < 10000) {
      s = await snap()
      if (s.aboard) { r.aboardS = +((Date.now() - t1) / 1000).toFixed(1); break }
      const dx = s.bal[0] - s.x, dz = s.bal[2] - s.z
      const d = Math.max(0.01, Math.hypot(dx, dz))
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw)
      const f = (dx * fx + dz * fz) / d, rr = (dx * rx + dz * rz) / d
      const want = new Set()
      if (f > 0.38) want.add('KeyW'); if (f < -0.38) want.add('KeyS')
      if (rr > 0.38) want.add('KeyD'); if (rr < -0.38) want.add('KeyA')
      await setKeys(want)
      await page.keyboard.down('Space'); await page.waitForTimeout(120); await page.keyboard.up('Space')
      await page.waitForTimeout(500)
    }
    await setKeys(new Set())
    r.end = await snap()
    await page.screenshot({ path: 'qa/' + TAG + '-run' + run + '.png' })
    out.runs.push(r)
    await post(out)
  }
  out.pass = out.runs.filter(r => r.aboardS !== null).length + ' of ' + out.runs.length
  await post(out)
}
