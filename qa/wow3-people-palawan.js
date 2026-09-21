async page => {
  // ROADMAP-WOW2 V2 — THE PEOPLE SHEET. One chapter per run (set CHAP), under
  // four minutes, with the governor pinned to 'pretty' so rung 0 is held.
  //
  // Five reads, in the order they were written:
  //
  //  1. THE GAIT, off the instance seeds — how many of each profile, how many
  //     walking, mid-pause, sat. A gait shows only while somebody walks, so a
  //     still cannot count it (game.peopleAudit.gait).
  //  2. THE CROWD'S OWN MASK, and the motion inside it. The camera is pinned
  //     on the DENSEST GROUP (the 6 m disc with the most people in it, roster
  //     and locals together) and never moves again. Hide-and-diff: hide every
  //     person, render, show, render — the changed pixels are the mask. Then
  //     twenty seconds of frame PAIRS ~120 ms apart through that one camera,
  //     counting moved pixels (threshold 8) INSIDE the mask only, so the
  //     weather, the water and the grass are not in the number.
  //  3. THE SAME AGAIN WITH noGesture SET. The difference is what the gesture
  //     pool is worth in moved pixels; the rest of the motion (the stride, the
  //     breath, the stance) is in both arms.
  //  4. UMBRELLAS UP under a forced shower — trap 35: `odds: 1, hold: 14`, the
  //     front pinned on the line with hud.front(0), and rainT SAMPLED every
  //     250 ms rather than glanced at, because the envelope's rise is a fifth
  //     of the hold. A screenshot goes with it, to be read by eye.
  //  5. COMPANY over 60 s of deterministic time, with the nearest-neighbour
  //     distances that say whether the chapter has any pairs to have it.
  const CHAP = 'palawan'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  if (CHAP !== 'sydney') { await page.evaluate((n) => window.__capy.hud.cross(n), CHAP); await page.waitForTimeout(9500) }
  const out = { errs, chap: CHAP, thresh: 8 }
  out.started = await page.evaluate(() => ({ started: window.__capy.state.started, biome: window.__capy.biome.current, rung: window.__capy.state.perfRung }))

  // ---- 1. the gait ---------------------------------------------------------
  out.gait = await page.evaluate(() => window.__capy.peopleAudit.gait())

  // ---- 2 + 3. the crowd's mask, live and with the gestures cut -------------
  // ONE camera and ONE mask for BOTH arms, pinned here: the densest group
  // moves (people walk), so an arm that re-picks its own spot is comparing
  // two different pictures and the difference is the spot, not the flag.
  out.pin = await page.evaluate(() => {
    const g = window.__capy
    const live = g.biome.current
    const pts = []
    for (const l of g.locals) if (l.biome === live && l.group) pts.push({ x: l.x, y: l.y, z: l.z })
    // THE ROSTER IS NOT REACHABLE FROM THE PAGE. Its groups are pure
    // Object3D skeletons that are never added to the scene (npc.js's own
    // first note), and game.npcs is main.js's array of registered spawns,
    // not the module — so .parent, g.humans and g.npcs.humans all find
    // nothing and Sydney's densest "group" came out as one lone local with
    // an empty mask, which reads exactly like "nobody moved". The rows of
    // the gait audit are the way in: they carry x/z/state/speed per cast
    // member in the live chapter.
    for (const r of (g.peopleAudit.gait(true).rows || [])) pts.push({ x: r.x, y: r.y || 0, z: r.z })
    let best = pts[0] || { x: 0, y: 0, z: 0 }, bn = 0
    for (const p of pts) {
      let n = 0
      for (const q of pts) if (Math.hypot(p.x - q.x, p.z - q.z) < 6) n++
      if (n > bn) { bn = n; best = p }
    }
    // ...from a bearing that can actually SEE them: eight tried, the first
    // whose ray to the group's chest is not stopped short. A lens pinned
    // inside a wall gives a mask of zero pixels, which is what Sydney's
    // first run did and which reads exactly like "nobody moved".
    const T = g.THREE, rc = new T.Raycaster(), aim = new T.Vector3(best.x, best.y + 1.0, best.z)
    const cam = g.camera.clone()
    let yaw = Math.atan2(best.x - g.capy.position.x, best.z - g.capy.position.z) + Math.PI, seen = false
    for (let k = 0; k < 8 && !seen; k++) {
      const yy = yaw + k * 0.785
      const pos = new T.Vector3(best.x + Math.sin(yy) * 9, best.y + 2.4, best.z + Math.cos(yy) * 9)
      rc.set(pos, aim.clone().sub(pos).normalize())
      const hits = rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible && h.distance > 0.3)
      if (!hits.length || hits[0].distance > pos.distanceTo(aim) - 1.2) { yaw = yy; seen = true }
    }
    cam.position.set(best.x + Math.sin(yaw) * 9, best.y + 2.4, best.z + Math.cos(yaw) * 9)
    cam.lookAt(best.x, best.y + 1.0, best.z)
    cam.updateMatrixWorld(true)
    window.__pin = cam
    window.__pinAt = { x: best.x, z: best.z }
    // ...and the mask, ONCE, from the same camera: hide every person (the
    // locals' groups and npc.js's own named instanced buffers — 'npcCast',
    // because "instanced and small" also describes a market stall), render,
    // show, render. Both arms count inside this one mask, or the difference
    // is the mask and not the flag.
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const hidden = []
    const hide = o => { if (o && o.visible !== false) { hidden.push(o); o.visible = false } }
    for (const l of g.locals) if (l.group) hide(l.group)
    g.scene.traverse(o => { if (o.name === 'npcCast') hide(o) })
    const A = grab()
    for (const o of hidden) o.visible = true
    const B = grab()
    const n = W * H
    const mask = new Uint8Array(n)
    let maskN = 0
    for (let i = 0; i < n; i++) {
      const j = i * 4
      const d = Math.max(Math.abs(A[j] - B[j]), Math.abs(A[j + 1] - B[j + 1]), Math.abs(A[j + 2] - B[j + 2]))
      if (d > 8) { mask[i] = 1; maskN++ }
    }
    window.__mask = mask
    return { x: +best.x.toFixed(1), z: +best.z.toFixed(1), n: bn, seen: seen, hidden: hidden.length,
             maskPx: maskN, maskPct: +(100 * maskN / n).toFixed(3), W, H }
  })
  // INTERLEAVED, the frame-time A/B's own shape and for the same reason:
  // a walker crossing the mask moves four thousand pixels and a two-second
  // arm moves a few hundred, so two arms twenty seconds apart measure who
  // happened to be walking. The flag flips between every PAIR, so the walk
  // is in both arms and the difference is the gesture.
  out.motion = await page.evaluate(async () => {
    const g = window.__capy
    const cam = window.__pin, mask = window.__mask
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const ctx = c2.getContext('2d', { willReadFrequently: true })
    const grab = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data }
    const n = W * H
    let maskN = 0
    for (let i = 0; i < n; i++) if (mask[i]) maskN++
    // ...and a pair is only counted while NOBODY IN THE MASK IS WALKING. A
    // walker crossing it moves four thousand pixels and a raised arm moves a
    // few hundred: with the walk in the sample the number is a count of who
    // happened to be on the move, which is what the first cut of this
    // measured (Marrakech, medians 9293 live / 8707 cut — noise either way).
    const pin = window.__pinAt
    // ...within SIX metres of the pin, not fourteen: a chapter with one
    // pacing local (D2's walk routes) never has a quiet fourteen-metre disc
    // and the sheet returns nothing at all, which is what Marrakech did.
    // ...and the gate is a CEILING on walkers, not zero of them. Sydney's
    // roster has seventeen of thirty-two on the move at any moment and a
    // still six-metre disc never happens there: the first cut of this gate
    // skipped all eighty attempts and returned nothing. The ceiling starts
    // at zero and is raised once forty attempts have failed, and which
    // ceiling the run used is reported.
    let ceil = 0
    const walkers = () => {
      const live = g.biome.current
      let n = 0
      for (const l of g.locals) if (l.biome === live && l.group && Math.hypot(l.x - pin.x, l.z - pin.z) < 6 && (l.mv > 0.05 || l.moving > 0)) n++
      for (const r of (g.peopleAudit.gait(true).rows || [])) if (Math.hypot(r.x - pin.x, r.z - pin.z) < 6 && r.spd > 0.1) n++
      return n
    }
    const quiet = () => walkers() <= ceil
    const on = [], off = []
    let skipped = 0
    for (let p = 0; p < 110 && (on.length < 12 || off.length < 12); p++) {
      if (p === 40 && on.length + off.length < 4) ceil = 1
      if (p === 70 && on.length + off.length < 4) ceil = 99
      const flag = (on.length + off.length) % 2 === 1
      g.state.noGesture = flag
      await new Promise(res => setTimeout(res, 260))
      if (!quiet()) { skipped++; await new Promise(res => setTimeout(res, 300)); continue }
      const a = grab()
      await new Promise(res => setTimeout(res, 120))
      const b = grab()
      let m = 0
      for (let i = 0; i < n; i++) {
        if (!mask[i]) continue
        const j = i * 4
        const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
        if (d > 8) m++
      }
      if (quiet()) (flag ? off : on).push(m); else skipped++
      await new Promise(res => setTimeout(res, 380))
    }
    g.state.noGesture = false
    // RENDER, THEN READ, with nothing awaited between: the drawing buffer is
    // cleared on the next frame and a toDataURL after an await comes back a
    // blank white page (Iceland's crowd shot, first run).
    g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam)
    const shot = g.renderer.domElement.toDataURL('image/png')
    await fetch('/shot?name=wow2-people-' + g.biome.current + '-crowd', { method: 'POST', body: shot.split(',')[1] })
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length
    return { maskPx: maskN, pairs: on.length, cutPairs: off.length, skipped: skipped, walkerCeiling: ceil,
             liveMed: med(on), cutMed: med(off), liveMean: +mean(on).toFixed(1), cutMean: +mean(off).toFixed(1),
             liveMedPctOfMask: +(100 * med(on) / Math.max(1, maskN)).toFixed(2),
             cutMedPctOfMask: +(100 * med(off) / Math.max(1, maskN)).toFixed(2),
             live: on, cut: off }
  })
  out.gestDelta = { medPx: out.motion.liveMed - out.motion.cutMed,
                    meanPx: +(out.motion.liveMean - out.motion.cutMean).toFixed(1),
                    medPctOfMask: +(out.motion.liveMedPctOfMask - out.motion.cutMedPctOfMask).toFixed(2) }
  out.gestAfter = await page.evaluate(() => window.__capy.peopleAudit.gesture())

  // ---- 4. the umbrellas, under a forced shower (trap 35) -------------------
  out.dry = await page.evaluate(() => window.__capy.peopleAudit.umbrella(true))
  await page.evaluate((n) => {
    const g = window.__capy
    const row = g.weather.rowOf(n)
    g.weather.set(n, { rain: { odds: 1, peak: Math.max(row.rain.peak, 0.6), hold: 14, gap: 1 } })
    g.hud.front(0)
    window.__m = []
    window.__mi = setInterval(() => { const a = g.peopleAudit.umbrella(); window.__m.push({ t: +g.state.time.toFixed(1), rain: a.rain, fn: a.frontNear, lup: a.locals.up, rup: a.roster.up }) }, 250)
  }, CHAP)
  await page.waitForTimeout(7000)
  out.wet = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const a = g.peopleAudit.umbrella()
    const row = a.rows[0]
    if (row) {
      const cam = g.camera.clone(), rc = new T.Raycaster(), head = new T.Vector3(row.x, row.y + 1.4, row.z)
      let yaw = (row.yaw || 0) + 0.6
      for (let k = 0; k < 8; k++) {
        const yy = yaw + k * 0.785
        const pos = new T.Vector3(row.x + Math.sin(yy) * 5.5, row.y + 2.0, row.z + Math.cos(yy) * 5.5)
        rc.set(pos, head.clone().sub(pos).normalize())
        const hits = rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible && h.distance > 0.2)
        if (!hits.length || hits[0].distance > pos.distanceTo(head) - 1.0) { yaw = yy; break }
      }
      cam.position.set(row.x + Math.sin(yaw) * 5.5, row.y + 2.0, row.z + Math.cos(yaw) * 5.5)
      cam.lookAt(row.x, row.y + 1.2, row.z)
      cam.updateMatrixWorld(true)
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=wow2-people-' + g.biome.current + '-umb', { method: 'POST', body: d.split(',')[1] })
    }
    return a
  })
  await page.waitForTimeout(4000)
  out.rainTrace = await page.evaluate(() => { clearInterval(window.__mi); const m = window.__m; const pk = f => m.reduce((a, x) => Math.max(a, x[f]), 0); return { samples: m.length, peakRain: pk('rain'), peakLocalsUp: pk('lup'), peakRosterUp: pk('rup'), trace: m.filter((x, i) => i % 4 === 0) } })

  // ---- 5. company, 60 s ----------------------------------------------------
  out.pairsNear = await page.evaluate(() => {
    const g = window.__capy, live = g.biome.current
    const L = g.locals.filter(l => l.biome === live && l.fig)
    const d = []
    for (let i = 0; i < L.length; i++) { let b = 1e9; for (let j = 0; j < L.length; j++) if (i !== j) b = Math.min(b, Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z)); d.push(+b.toFixed(2)) }
    return { n: L.length, nn: d, under5: d.filter(x => x <= 5).length }
  })
  await page.evaluate(() => window.__capy.peopleAudit.company(true))
  for (let k = 0; k < 3; k++) await page.evaluate(() => { const g = window.__capy; for (let t = 0; t < 20 * 60; t++) g.tick(1 / 60, false) })
  out.company = await page.evaluate(() => window.__capy.peopleAudit.company())

  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-people-' + o.chap + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
