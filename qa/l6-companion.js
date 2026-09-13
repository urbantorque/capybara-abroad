async page => {
  // THE COMPANION (L6, F1). One timeline: a Venetian pigeon is carried into
  // Kowloon on the back; Space puts it down; it follows sixty seconds of
  // walking, harbour included; a two-second loaf puts it back on; the file
  // keeps it across page.reload(); and in Marrakech, hidden and still, a
  // wheek sends it out and the march ends `npc:lost` on a bird.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('l6keep')) localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { boot: await page.evaluate(() => ({ started: window.__capy.state.started, biome: window.__capy.biome.current })) }

  // ---- Venice: a pigeon on the back ----------------------------------------
  await page.evaluate(() => { const g = window.__capy; g.completeTask('gather', true); g.completeTask('the-crossing', true); g.hud.cross('venice') })
  await page.waitForTimeout(9000)
  out.mount = await page.evaluate(() => {
    const g = window.__capy
    const r = { biome: g.biome.current }
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    let k = g.herdDebug().kinds[0]
    for (let w = 0; w < 40 && (!k || !k.n || !k.first); w++) { tick(60); k = g.herdDebug().kinds[0] }
    if (!k || !k.first) { r.err = 'nothing offered'; return r }
    const px = k.first.x + 1.85 * 0.71, pz = k.first.z + 1.85 * 0.71
    const b = g.capy.body
    const pin = () => { b.position.x = px; b.position.z = pz; b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0) }
    b.position.set(px, k.first.y + 0.8, pz); tick(1)
    for (let i = 0; i < 240; i++) { pin(); g.tick(1 / 60, false) }
    for (let w = 0; w < 5; w++) {
      pin(); g.events.emit('capy:wheek', { position: g.capy.position, soft: false })
      for (let i = 0; i < 30; i++) { pin(); g.tick(1 / 60, false) }
    }
    let n = 0
    for (; n < 60 * 26 && g.perchCount() < 1; n++) {
      pin()
      if (n > 0 && n % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false })
      g.tick(1 / 60, false)
    }
    for (let i = 0; i < 90; i++) { pin(); g.tick(1 / 60, false) }
    r.on = g.perchCount(); r.ticks = n; r.stow = g.stowDebug()
    return r
  })

  // ---- ...and across the border, into Kowloon ------------------------------
  await page.evaluate(() => window.__capy.hud.cross('kowloon'))
  await page.waitForTimeout(9500)
  out.arrive = await page.evaluate(() => {
    const g = window.__capy
    const d = g.stowDebug(), p = g.capy.position
    return { biome: g.biome.current, stow: d, perch: g.perchCount(), pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
             finds: (function () { try { const raw = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); return { stow: raw && raw.stow, finds: raw && raw.finds ? raw.finds.filter(f => /stow/.test(f)) : null } } catch (e) { return null } })() }
  })
  await page.screenshot({ path: 'qa/l6-companion-arrive.png' })

  // ---- Space: it gets down and follows --------------------------------------
  await page.keyboard.press('Space')
  await page.waitForTimeout(1200)
  out.dismount = await page.evaluate(() => { const g = window.__capy; const d = g.stowDebug(); const p = g.capy.position; return { state: d.state, why: d.why, kind: d.kind, d: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2), y: d.y, capyY: +p.y.toFixed(2) } })

  // ---- sixty seconds of walking, harbour included ---------------------------
  // Driven by g.tick with camYaw 0 so input.x/z are world axes. Waypoints: a
  // ring on land, then out over the water and back. The water point is found
  // by scanning the live chapter's isOverWater from the spawn.
  const walk = await page.evaluate(() => {
    const g = window.__capy, api = g.kowloon
    // Kowloon is a street down z from the spawn (0, 34) to the pier at z -60,
    // the pontoon to -70 and the harbour beyond it. Down the street, onto
    // the planks, into the water, and back up.
    const wp = [
      { x: 1, z: 18 }, { x: -1, z: 0 }, { x: 1, z: -22 }, { x: 0, z: -44 }, { x: 2, z: -58 },
      { x: 2, z: -67 }, { x: 2, z: -80, wet: true }, { x: 2, z: -66 }, { x: 0, z: -52 }, { x: 0, z: -30 },
    ]
    for (const w of wp) w.water = api.isOverWater(w.x, w.z)
    window.__wp = wp; window.__wpi = 0; window.__rows = []
    return { wp: wp.map(w => [w.x, w.z, w.water ? 1 : 0]) }
  })
  out.walkPlan = walk
  const step = async (ticks) => page.evaluate((ticks) => {
    const g = window.__capy, inp = g.input, b = g.capy.body
    const rows = window.__rows
    for (let i = 0; i < ticks; i++) {
      const wp = window.__wp[window.__wpi]
      const p = g.capy.position
      if (wp) {
        const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz)
        if (d < 1.2) { window.__wpi++; inp.x = 0; inp.z = 0 }
        else { inp.x = dx / d; inp.z = dz / d }
      } else { inp.x = 0; inp.z = 0 }
      inp.camYaw = 0; inp.run = false; inp.jump = false; inp.jumpPressed = false; inp.honkPressed = false
      g.tick(1 / 60, false)
      if (i % 6 === 0) {
        const d = g.stowDebug()
        const c = g.companion()
        rows.push({ t: rows.length, d: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2), st: d.state, y: d.y, cy: +p.y.toFixed(2), px: +p.x.toFixed(1), pz: +p.z.toFixed(1),
                    swim: g.capy.swimming ? 1 : 0, wet: g.kowloon.isOverWater(d.x, d.z) ? 1 : 0, wait: d.waiting ? 1 : 0, wpi: window.__wpi,
                    loafT: g.perchDebug().loafT, off: g.perchDebug().off, car: g.capy.carriedBy ? (g.capy.carriedBy.role || 1) : 0, march: g.marchAudit().why, fv: +Math.hypot(g.capy.frameVX || 0, g.capy.frameVZ || 0).toFixed(2), gr: g.capy.grounded ? 1 : 0, mt: d.mt })
      }
    }
    inp.x = 0; inp.z = 0
    return { wpi: window.__wpi, n: rows.length, err: g.state.lastError || null }
  }, ticks)
  const legs = []
  for (let k = 0; k < 6; k++) {
    legs.push(await step(600))       // 3600 ticks = 60 s
    // a real frame mid-walk (leg 2 is the pier), before the loaf can build; C snaps the rig behind
    if (k === 0 || k === 2) { await page.keyboard.press('KeyC'); await page.waitForTimeout(450); await page.screenshot({ path: k === 0 ? 'qa/l6-companion-follow.png' : 'qa/l6-companion-follow-water.png' }) }
  }
  out.walk = await page.evaluate(() => {
    const rows = window.__rows
    const ds = rows.map(r => r.d)
    const within3 = ds.filter(d => d <= 3).length
    const wet = rows.filter(r => r.wet)
    const swim = rows.filter(r => r.swim)
    return { samples: rows.length, maxD: Math.max(...ds), meanD: +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(2),
             within3: within3, within3pct: +(100 * within3 / rows.length).toFixed(1),
             over5: ds.filter(d => d > 5).length,
             wetSamples: wet.length, wetY: wet.length ? { min: Math.min(...wet.map(r => r.y)), max: Math.max(...wet.map(r => r.y)) } : null,
             swimSamples: swim.length, swimD: swim.length ? +Math.max(...swim.map(r => r.d)).toFixed(2) : null,
             states: Array.from(new Set(rows.map(r => r.st))), wpiEnd: window.__wpi, waiting: rows.filter(r => r.wait).length,
             worst: rows.slice().sort((a, b) => b.d - a.d).slice(0, 3),
             transitions: rows.filter((r, i) => i > 0 && r.st !== rows[i - 1].st).map(r => ({ t: r.t, st: r.st, d: r.d, loafT: r.loafT, off: r.off, fv: r.fv, gr: r.gr, px: r.px, pz: r.pz, swim: r.swim, carried: r.car, march: r.march })).slice(0, 12) }
  })
  out.walkLegs = legs

  // ---- the two-second loaf: it climbs back on --------------------------------
  out.remount = await page.evaluate(() => {
    const g = window.__capy, inp = g.input
    inp.x = 0; inp.z = 0
    // if a carrier put it back on during the walk, a hop puts it down first
    let wasOn = g.stowDebug().state
    if (wasOn === 'on' || wasOn === 'climb') { g.capy.launch(0, 8, 0); for (let i = 0; i < 90; i++) g.tick(1 / 60, false) }
    const afterHop = g.stowDebug().state
    let n = 0, climbAt = -1, onAt = -1
    for (; n < 60 * 14; n++) {
      g.tick(1 / 60, false)
      const s = g.stowDebug().state
      if (s === 'climb' && climbAt < 0) climbAt = n
      if (s === 'on') { onAt = n; break }
    }
    const d = g.stowDebug()
    return { wasOn, afterHop, climbAt: climbAt >= 0 ? +(climbAt / 60).toFixed(2) : null, onAt: onAt >= 0 ? +(onAt / 60).toFixed(2) : null,
             state: d.state, loaf: +g.capy.loaf.toFixed(2), perch: g.perchCount(), err: g.state.lastError || null }
  })
  await page.waitForTimeout(600)

  // ---- the portrait: K, then Q to 'with the companion' -----------------------
  // It is on the back now; Space puts it down first so the flank pose has
  // something to stand at the flank.
  await page.keyboard.press('Space')
  await page.waitForTimeout(1500)
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(800)
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(150) }
  await page.waitForTimeout(1600)
  out.portrait = await page.evaluate(() => {
    const g = window.__capy
    const a = g.hud.photoAudit ? g.hud.photoAudit() : null
    const hint = (document.querySelector('.capyui-phint') || {}).textContent || ''
    const d = g.stowDebug(), p = g.capy.position
    return { pose: a && a.pose, hint: hint.slice(0, 160), state: d.state, d: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2) }
  })
  await page.screenshot({ path: 'qa/l6-companion-portrait.png' })
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(800)

  // ---- the file: reload, carry on, and it is there ---------------------------
  out.saved = await page.evaluate(() => { try { const raw = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); return raw ? { stow: raw.stow, biome: raw.biome } : null } catch (e) { return String(e) } })
  await page.evaluate(() => { try { sessionStorage.setItem('l6keep', '1') } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(6000)
  out.reloadTitle = await page.evaluate(() => ({ carry: !!document.querySelector('.capyui-carry'), go: !!document.querySelector('.capyui-go') }))
  await page.evaluate(() => { const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(8000)
  out.reload = await page.evaluate(() => {
    const g = window.__capy
    const d = g.stowDebug(), p = g.capy.position
    return { started: g.state.started, biome: g.biome.current, kind: d.kind, from: d.from, state: d.state,
             d: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2), visible: !!(g.scene.children.find(o => o.__stowTag && o.visible)), err: g.state.lastError || null }
  })

  // ---- Marrakech: the decoy ---------------------------------------------------
  await page.evaluate(() => window.__capy.hud.cross('sahara'))
  await page.waitForTimeout(9500)
  out.sahara = await page.evaluate(() => {
    const g = window.__capy
    const d = g.stowDebug()
    // eighteen metres off the spawn, every local on a 13 m ring, the way
    // qa/l3-authority.js sets a march up
    const b = g.capy.body, sp = g.biome.spawnOf('sahara')
    const th = g.sahara.terrainHeight
    const x = sp.x + 18, z = sp.z
    b.position.set(x, th(x, z) + 0.6, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    const p = g.capy.position
    let k = 0, n = 0
    for (const r of g.locals) if (r.biome === 'sahara' && r.group) n++
    for (const r of g.locals) {
      if (r.biome !== 'sahara' || !r.group) continue
      const a = (k++ / Math.max(1, n)) * 6.283185
      r.x = p.x + Math.sin(a) * 13; r.z = p.z + Math.cos(a) * 13
      r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z; r.marCool = 0; r.escT = -1
      r.group.position.set(r.x, r.group.position.y, r.z)
      if (r.body) { r.body.position.x = r.x; r.body.position.z = r.z; r.body.aabbNeedsUpdate = true }
    }
    return { biome: g.biome.current, stow: { kind: d.kind, state: d.state }, locals: n, hides: g.hides().filter(h => h.biome === 'sahara').length }
  })
  // put it down: it must be following, not on the back, to be sent anywhere
  await page.keyboard.press('Space')
  await page.waitForTimeout(1200)
  // the chain: five cones, the march sets off
  const built = await page.evaluate(() => new Promise((res) => {
    const g = window.__capy
    let dropped = 0, nextDrop = 0
    const t0 = performance.now()
    ;(function step() {
      const t = (performance.now() - t0) / 1000
      if (dropped < 5 && t >= nextDrop) {
        dropped++; nextDrop = t + 1.5
        const p = g.capy.position
        const pr = g.physics.spawnProp('cone', p.x + 1.4, p.z + 1.4)
        if (pr && pr.body) { pr.disturbed = true; pr.lastCapyTouch = g.state ? g.state.time : 0; pr.body.wakeUp(); pr.body.position.y += 2.4; pr.body.velocity.set(0, -6, 0) }
      }
      const a = g.marchAudit ? g.marchAudit() : null
      if ((a && a.on) || t > 12) res({ t: +t.toFixed(1), on: a && a.on, why: a && a.why, authority: a && a.authority, dist: a && a.dist })
      else requestAnimationFrame(step)
    })()
  }))
  out.march = built
  // into the nearest hide, still
  out.hide = await page.evaluate(() => {
    const g = window.__capy, p = g.capy.position
    const hs = g.hides().filter(h => h.biome === 'sahara')
    let best = hs[0], bd = 1e9
    for (const h of hs) { const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < bd) { bd = d; best = h } }
    const b = g.capy.body, y = g.sahara.terrainHeight(best.x, best.z) + 0.6
    b.position.set(best.x, y, best.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    window.__lost = null
    g.events.on('npc:lost', (e) => { const d = e && (e.npc || e); window.__lost = { decoy: !!(d && d.decoy), x: d && d.x, z: d && d.z } })
    return { kind: best.kind, d: +bd.toFixed(1) }
  })
  await page.waitForTimeout(900)
  out.hidden0 = await page.evaluate(() => ({ hidden: +window.__capy.hidden().toFixed(2), march: window.__capy.marchAudit().why }))
  await page.keyboard.press('KeyQ')
  const track = await page.evaluate(() => new Promise((res) => {
    const g = window.__capy
    const t0 = performance.now()
    const p0 = { x: g.capy.position.x, z: g.capy.position.z }
    let decoySeen = 0, hiddenMin = 1, why = '', marchToComp = 1e9, lostSeen = false, decoyMaxD = 0
    ;(function step() {
      const t = (performance.now() - t0) / 1000
      const a = g.marchAudit(), d = g.stowDebug()
      const dc = g.decoyAt()
      if (dc) decoySeen++
      hiddenMin = Math.min(hiddenMin, g.hidden())
      if (a.why === 'lost you') lostSeen = true
      why = a.why
      const p = g.capy.position
      decoyMaxD = Math.max(decoyMaxD, Math.hypot(d.x - p.x, d.z - p.z))
      const m = g.locals.find(r => r.biome === 'sahara' && r.group && r.marCool > 17.5)
      if (a.on) {
        for (const r of g.locals) if (r.biome === 'sahara' && r.group) marchToComp = Math.min(marchToComp, Math.hypot(r.x - d.x, r.z - d.z))
      }
      const done = (!a.on && t > 1.5) || t > 20
      if (done) {
        res({ t: +t.toFixed(1), why, lostSeen, decoySeen, hiddenMin: +hiddenMin.toFixed(2), decoyMaxD: +decoyMaxD.toFixed(1),
              moved: +Math.hypot(p.x - p0.x, p.z - p0.z).toFixed(2), lost: window.__lost, compState: d.state,
              nearestMarcherToComp: +marchToComp.toFixed(1), tasks: g.hud.tasksDone(), souk: g.taskDone ? g.taskDone('souk-decoy') : null,
              err: g.state.lastError || null })
      } else requestAnimationFrame(step)
    })()
  }))
  out.decoy = track
  await page.screenshot({ path: 'qa/l6-companion-decoy.png' })

  // ---- and the telling: hold Q beside it, "off you go" -----------------------
  await page.waitForTimeout(500)
  // Q is a KEY here, not input.honk: systems.js relatches input.honk from
  // the key table at the top of its own update, before the companion reads it.
  out.tellSetup = await page.evaluate(() => {
    const g = window.__capy
    // out of the hide first: telling is not for a hidden animal (hidden, Q is the decoy)
    { const b = g.capy.body, p = g.capy.position; const x = p.x + 9, z = p.z + 3; b.position.set(x, g.sahara.terrainHeight(x, z) + 0.6, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    if (g.stowDebug().state === 'on') { g.capy.launch(0, 8, 0); for (let i = 0; i < 90; i++) g.tick(1 / 60, false) }
    let n = 0
    for (; n < 60 * 8; n++) { g.tick(1 / 60, false); const d = g.stowDebug(); const p = g.capy.position; if (d.state === 'follow' && Math.hypot(d.x - p.x, d.z - p.z) < 2.4) break }
    const d = g.stowDebug(), p = g.capy.position
    return { waited: +(n / 60).toFixed(2), state: d.state, d: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2), hidden: +g.hidden().toFixed(2) }
  })
  await page.keyboard.down('KeyQ')
  await page.waitForTimeout(1700)
  const tellMid = await page.evaluate(() => { const g = window.__capy; const d = g.stowDebug(); return { state: d.state, tellT: d.tellT, why: d.why, honk: g.input.honk } })
  await page.keyboard.up('KeyQ')
  await page.waitForTimeout(3200)
  out.tell = await page.evaluate((mid) => { const g = window.__capy; const d = g.stowDebug(); return { mid, after: { kind: d.kind, state: d.state, why: d.why }, err: g.state.lastError || null } }, tellMid)
  out.errs = errs.slice(0, 20)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-companion.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
