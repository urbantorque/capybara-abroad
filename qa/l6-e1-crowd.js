async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, samples: [], legs: [] }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  await page.evaluate(() => window.__capy.hud.cross('venice'))
  await page.waitForTimeout(9500)
  // the sampler: every 100 ms, camInfo + an independent segment test on the person bodies
  await page.evaluate(() => {
    const g = window.__capy
    window.__l6e1 = []
    window.__l6e1Timer = setInterval(() => {
      try {
        const ci = g.camInfo || {}
        const cam = g.camera.position, a = g.capy.position
        const ax = a.x - cam.x, ay = a.y + 0.5 - cam.y, az = a.z - cam.z
        const L = Math.hypot(ax, ay, az)
        let onSeg = 0, onSegNear = 0
        const bodies = g.world.bodies
        for (let i = 0; i < bodies.length; i++) {
          const b = bodies[i], ud = b.userData
          if (!ud || !(ud.npc || ud.local || ud.crowd)) continue
          if (ud.crowd && ud.idx < 0) continue
          // segment vs the person's box (0.30 x 0.90 x 0.30 half-extents, a little fat): slab test
          const p = b.position
          let t0 = 0, t1 = 1, ok = true
          const c0 = [cam.x, cam.y, cam.z], dd = [ax, ay, az], pc = [p.x, p.y, p.z], he = [0.30, 0.90, 0.30]
          for (let k = 0; k < 3 && ok; k++) {
            const lo = pc[k] - he[k] - c0[k], hi = pc[k] + he[k] - c0[k]
            if (Math.abs(dd[k]) < 1e-6) { if (lo > 0 || hi < 0) ok = false; continue }
            let ta = lo / dd[k], tb = hi / dd[k]; if (ta > tb) { const q = ta; ta = tb; tb = q }
            if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) ok = false
          }
          if (ok) { onSeg++; if (t0 * L < 3.5) onSegNear++ }
        }
        const T = g.THREE
        const box = new T.Box3().setFromObject(g.capy.group)
        let minx = 9, maxx = -9, miny = 9, maxy = -9, behind = false
        for (let i = 0; i < 8; i++) {
          const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(g.camera)
          if (p.z > 1) behind = true
          minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y)
        }
        const inFrame = !behind && maxx > -1 && minx < 1 && maxy > -1 && miny < 1
        window.__l6e1.push({ t: +g.state.time.toFixed(2), lens: ci.lens, unf: ci.lensUnfaded, bias: +(ci.lensBias || 0).toFixed(2), onSeg, onSegNear, inFrame, dist: +L.toFixed(1), cuts: g.state.camCuts | 0, err: g.state.lastError ? String(g.state.lastError).slice(0, 120) : null })
      } catch (e) { window.__l6e1.push({ err: String(e).slice(0, 120) }) }
    }, 100)
  })
  // the walk: closed-loop, and the target is the point 7 m BEYOND a crowd member on the
  // line from the lens through them — the one place a person is between the lens and the animal
  const held = new Set()
  const setKeys = async (want) => {
    for (const k of Array.from(held)) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
  }
  let leg = 0, shot = 0, legT0 = Date.now(), t0 = Date.now()
  out.noCrowd = 0
  const walk = async (ms) => { t0 = Date.now(); legT0 = t0; while (Date.now() - t0 < ms) {
    const st = await page.evaluate((leg) => {
      window.__l6leg = window.__l6leg || { leg: -1, idx: -1 }
      const g = window.__capy
      const bodies = g.world.bodies.filter(b => b.userData && b.userData.crowd && b.userData.idx >= 0 && b.position.y > -5 && b.position.x > -15 && b.position.x < 7 && b.position.z > -55 && b.position.z < 10)
      if (!bodies.length) return null
      const p = g.capy.position, cam = g.camera.position
      // nearest member to the animal that is not already too close, leg-rotated
      let b = null, bd = 1e9
      if (window.__l6leg.leg === leg) b = bodies.find(c => c.userData.idx === window.__l6leg.idx) || null
      if (!b) {
        for (let k = 0; k < bodies.length; k++) { const c = bodies[(leg * 5 + k) % bodies.length]; const d = Math.hypot(c.position.x - p.x, c.position.z - p.z); if (d > 2.5 && d < 14 && d < bd) { bd = d; b = c } }
        if (!b) b = bodies[(leg * 5) % bodies.length]
        window.__l6leg = { leg, idx: b.userData.idx }
      }
      let ex = b.position.x - cam.x, ez = b.position.z - cam.z; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el
      const tx = b.position.x + ex * 7.0, tz = b.position.z + ez * 7.0
      const dx = tx - p.x, dz = tz - p.z
      const d = Math.hypot(dx, dz)
      const yaw = g.input.camYaw
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      const rx = Math.cos(yaw), rz = -Math.sin(yaw)
      const f = (dx * fx + dz * fz) / d, r = (dx * rx + dz * rz) / d
      return { d, f, r, n: bodies.length, tx: +tx.toFixed(1), tz: +tz.toFixed(1), px: +p.x.toFixed(1), pz: +p.z.toFixed(1) }
    }, leg)
    if (!st) { out.noCrowd++; await setKeys(new Set()); await page.waitForTimeout(300); continue }
    out.trace = out.trace || []; if (out.trace.length < 400) out.trace.push([Math.round((Date.now() - t0) / 100), st.px, st.pz, st.tx, st.tz, +st.d.toFixed(1)])
    if (st.d < 0.9 || Date.now() - legT0 > 7000) { leg++; legT0 = Date.now(); out.legs.push({ leg, at: Date.now() - t0, d: +st.d.toFixed(1) }); await setKeys(new Set()); await page.waitForTimeout(1200); continue }
    const want = new Set()
    if (st.f > 0.3) want.add('KeyW'); else if (st.f < -0.3) want.add('KeyS')
    if (st.r > 0.3) want.add('KeyD'); else if (st.r < -0.3) want.add('KeyA')
    await setKeys(want)
    await page.waitForTimeout(150)
    if (Date.now() - t0 > (shot + 1) * 8000) { await page.screenshot({ path: 'qa/l6-e1-crowd-' + shot + '.png' }); shot++ }
  } }
  // phase 1: the reviewer's walk — W from the spawn for 3 s with the crowd still on the paving, then 8 s among them
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW')
  await page.screenshot({ path: 'qa/l6-e1-crowd-w3.png' })
  await walk(8000)
  await setKeys(new Set())
  // phase 2: the next low-water window, 22 s more
  out.samplesA = await page.evaluate(() => { const r = window.__l6e1; window.__l6e1 = []; return r })
  // wait for low water: the crowd is on the paving (not the planks) for ~70 s of each tide
  out.waited = 0
  const upN = () => page.evaluate(() => window.__capy.world.bodies.filter(b => b.userData && b.userData.crowd && b.userData.idx >= 0 && b.position.y > -5).length)
  // the START of a low-water window: wait for the planks, then for the paving again
  for (let i = 0; i < 240; i++) { if (await upN() < 5) break; out.waited++; await page.waitForTimeout(1000) }
  for (let i = 0; i < 240; i++) { if (await upN() > 40) break; out.waited++; await page.waitForTimeout(1000) }
  await walk(22000)
  await setKeys(new Set())
  out.samples = out.samplesA.concat(await page.evaluate(() => { clearInterval(window.__l6e1Timer); return window.__l6e1 }))
  delete out.samplesA
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6-e1-crowd-rest.png' })
  out.rest = await page.evaluate(() => { const g = window.__capy; const ci = g.camInfo; return { lens: ci.lens, unf: ci.lensUnfaded, bias: ci.lensBias, biome: g.biome.current, err: g.state.lastError ? String(g.state.lastError) : null } })
  const n = out.samples.length
  const near = out.samples.filter(s => s.onSegNear > 0)
  const bad = out.samples.filter(s => s.onSegNear > 0 && (s.unf > 0 || (s.lens | 0) === 0)).length
  const badRig = out.samples.filter(s => s.unf > 0).length
  const noFrame = out.samples.filter(s => s.inFrame === false).length
  out.summary = { n, legs: out.legs.length, framesPersonNearOnSeg: near.length, framesUnfadedPct: +(100 * badRig / n).toFixed(1), framesNearMissedPct: +(100 * bad / n).toFixed(1), animalOutOfFramePct: +(100 * noFrame / n).toFixed(1), maxLens: Math.max(...out.samples.map(s => s.lens | 0)), fadedFrames: out.samples.filter(s => (s.lens | 0) > 0).length, cuts: out.samples[n - 1] && out.samples[n - 1].cuts }
  await page.evaluate((o) => fetch('/shot?name=l6-e1-crowd.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
