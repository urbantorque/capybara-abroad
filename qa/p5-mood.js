async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs: [] }

  const stat = (rows) => {
    if (!rows || !rows.length) return null
    let n = rows.length, mx = -9, mn = 9, eyMax = 0, eyMin = 9, btMax = -9, btMin = 9
    let hLo = 99, hHi = 0
    const arch = [0, 0, 0, 0]
    for (const r of rows) {
      if (r.mood > mx) mx = r.mood
      if (r.mood < mn) mn = r.mood
      if (r.eyeY > eyMax) eyMax = r.eyeY
      if (r.eyeY < eyMin) eyMin = r.eyeY
      if (r.browT > btMax) btMax = r.browT
      if (r.browT < btMin) btMin = r.browT
      if (r.arch >= 0 && r.arch < 4) arch[r.arch]++
      if (r.h > 0) { if (r.h < hLo) hLo = r.h; if (r.h > hHi) hHi = r.h }
    }
    return { n: n, moodMax: mx, moodMin: mn, eyeMax: eyMax, eyeMin: eyMin,
             browTMax: btMax, browTMin: btMin, arch: arch,
             hLo: hLo === 99 ? -1 : hLo, hHi: hHi }
  }

  // ---- 1. Sydney: the roster startles, then settles ----------------------
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  out.sydney = await page.evaluate(async () => {
    const g = window.__capy
    const grab = (k) => (g.faceAudit ? g.faceAudit().filter(r => r.kind === k) : [])
    const r = {}
    r.rest = grab('roster')
    // stand in the middle of the crowd so everybody is inside the 20 m ring
    let sx = 0, sz = 0, n = 0
    for (const p of g.npcs) { if (p.group) { sx += p.group.position.x; sz += p.group.position.z; n++ } }
    if (n) { sx /= n; sz /= n }
    let gy = g.capy.position.y
    try { const a = g[g.biome.current]; if (a && a.terrainHeight) gy = a.terrainHeight(sx, sz) + 0.6 } catch (e) {}
    g.capy.body.position.set(sx, gy, sz)
    await new Promise(res => setTimeout(res, 1500))
    return r
  })
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(500)
  out.sydney.wide = await page.evaluate(() => window.__capy.faceAudit().filter(r => r.kind === 'roster'))
  // ...and the blink, sampled across the settle
  out.sydney.blink = await page.evaluate(async () => {
    const g = window.__capy
    let shut = 0, samples = 0, minEye = 9
    for (let i = 0; i < 90; i++) {
      const rows = g.faceAudit().filter(r => r.kind === 'roster')
      for (const r of rows) { samples++; if (r.eyeY < 0.5) shut++; if (r.eyeY < minEye) minEye = r.eyeY }
      await new Promise(res => setTimeout(res, 100))
    }
    return { shut: shut, samples: samples, minEye: minEye }
  })
  out.sydney.settled = await page.evaluate(() => window.__capy.faceAudit().filter(r => r.kind === 'roster'))
  out.chase = await page.evaluate(async () => {
    const g = window.__capy
    const N = g.npcs.filter(n => n.nodes && n.face && n.state !== 'chase').slice(0, 3)
    const ids = N.map(n => n.id)
    const before = g.faceAudit().filter(r => ids.indexOf(r.id) >= 0)
    for (const n of N) n.state = 'chase'
    await new Promise(r => setTimeout(r, 1400))
    const after = g.faceAudit().filter(r => ids.indexOf(r.id) >= 0)
    return { n: N.length, before: before, after: after }
  })

  for (const k of ['rest', 'wide', 'settled']) out.sydney[k] = stat(out.sydney[k])

  // ---- 2. Venice: a local guards, and a local flinches -------------------
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(6000)
  out.venice = {}
  out.venice.rest = await page.evaluate(async () => {
    const g = window.__capy
    const L = (g.locals || []).filter(l => l.biome === g.biome.current && l.fig)
    if (L.length) {
      const w = L[0]
      let gy = g.capy.position.y
      try { const a = g[g.biome.current]; if (a && a.terrainHeight) gy = a.terrainHeight(w.x, w.z + 3) + 0.6 } catch (e) {}
      g.capy.body.position.set(w.x, gy, w.z + 3)
      await new Promise(r => setTimeout(r, 2000))
    }
    return window.__capy.faceAudit().filter(r => r.kind === 'local')
  })
  out.venice.rush = await page.evaluate(async () => {
    const g = window.__capy
    const L = (g.locals || []).filter(l => l.biome === g.biome.current && l.fig)
    if (!L.length) return null
    const w = L[0]
    let gy = g.capy.position.y
    try { const a = g[g.biome.current]; if (a && a.terrainHeight) gy = a.terrainHeight(w.x, w.z + 10) + 0.6 } catch (e) {}
    g.capy.body.position.set(w.x, gy, w.z + 13)
    g.capy.body.velocity.set(0, 0, 0)
    await new Promise(r => setTimeout(r, 900))
    let mood = -9, eye = 0, brow = 9, sp = 0, minD = 99
    // A BARE VELOCITY WRITE IS FOUGHT BY THE MOVEMENT SYSTEM. The first cut of
    // this set body.velocity.z every 50 ms and the animal topped out at 3.6
    // m/s, well under the 6.2 that npcLOC_RUSH_V calls belting past — so the
    // flinch never fired and the probe reported the mechanic as dead.
    // Held keys, camera-relative, with the yaw re-read every step.
    const kd = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true }))
    const ku = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true }))
    kd('ShiftLeft')
    let held = ''
    for (let i = 0; i < 44; i++) {
      // steer at the person: pick the WASD key nearest the bearing, in the
      // camera's frame, and re-pick it every step because camYaw drifts.
      const bx = w.x - g.capy.position.x, bz = w.z - g.capy.position.z
      const rel = Math.atan2(bx, bz) - (g.input.camYaw || 0)
      const q = ['KeyW', 'KeyA', 'KeyS', 'KeyD'][((Math.round(rel / (Math.PI / 2)) % 4) + 4) % 4]
      if (q !== held) { if (held) ku(held); kd(q); held = q }
      await new Promise(r => setTimeout(r, 50))
      const v = g.capy.velocity
      sp = Math.max(sp, Math.hypot(v.x, v.z))
      minD = Math.min(minD, Math.hypot(w.x - g.capy.position.x, w.z - g.capy.position.z))
      for (const r of g.faceAudit()) {
        if (r.kind !== 'local') continue
        if (r.mood > mood) mood = r.mood
        if (r.eyeY > eye) eye = r.eyeY
        if (r.browT < brow) brow = r.browT
      }
    }
    if (held) ku(held)
    ku('ShiftLeft')
    // MEASURED: minD came back 13.0 — the closed loop above never got one
    // metre nearer than it started, almost certainly because this local is
    // across a canal. capySpd 7.4 proves the keys reached the game; the
    // steering did not reach the person. So the rush path is UNTESTED here,
    // and the spring is kicked directly instead: what that isolates is the
    // half this batch wrote (does r.fl reach the face) from the half it did
    // not (can a player belt past a Venetian).
    // ...and the spring on its own, so a probe that cannot get inside 3.4 m
    // is told apart from a face that does not read the spring at all.
    w.flV -= 12
    let kMood = -9, kEye = 0
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 50))
      for (const r of g.faceAudit()) {
        if (r.kind !== 'local') continue
        if (r.mood > kMood) kMood = r.mood
        if (r.eyeY > kEye) kEye = r.eyeY
      }
    }
    return { moodMax: mood, eyeMax: eye, browTMin: brow, capySpd: Math.round(sp * 10) / 10,
             minD: Math.round(minD * 10) / 10, kickMood: kMood, kickEye: kEye,
             fl: Math.round(w.fl * 100) / 100 }
  })
  out.venice.hot = await page.evaluate(async () => {
    const g = window.__capy
    if (g.forceHeat) g.forceHeat(1)
    await new Promise(r => setTimeout(r, 4000))
    return g.faceAudit().filter(r => r.kind === 'local')
  })
  await page.evaluate(() => { if (window.__capy.forceHeat) window.__capy.forceHeat(-1) })
  for (const k of ['rest', 'hot']) out.venice[k] = stat(out.venice[k])

  // ---- 3. Pasto: the third crowd exists at all ---------------------------
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(6500)
  out.pasto = await page.evaluate(() => {
    const g = window.__capy
    const rows = g.faceAudit ? g.faceAudit() : []
    return { biome: g.biome.current, kinds: rows.map(r => r.kind).filter((v, i, a) => a.indexOf(v) === i),
             rows: rows.length }
  })
  out.pastoStat = stat(await page.evaluate(() => window.__capy.faceAudit().filter(r => r.kind === 'pasto')))

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p5-mood.json', { method: 'POST', body: s })
  }, out)
}
