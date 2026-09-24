async page => {
  // T4d, noHerdCascade: how many wheeks gather the herd, with and without.
  //  - the herd put beside the animal (herdToCrossing), the animal on the
  //    bank next to it, one wheek a second on the hand clock: wheeks to 4
  //    (the crossing's ask) and to 9, the cascade live and flagged
  //  - the answers: reply delays of one cascading call, 0.12 s apart
  //  - the look-up: with five behind, grazers within 16 m trail for 6 s and
  //    close on the tail; they are not followers
  //  - one real Q on the real clock after three recruits: the count jumps
  // Fresh session after any pantanal.js edit (modules cache across goto).
  const NAME = 'ten-t4d-herd'
  const PORT = 5194
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome && window.__capy.biome.current === 'pantanal'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'pantanal') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('pantanal') }); await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const run = flag => page.evaluate(flag => {
    const g = window.__capy, P = g.pantanal, b = g.capy.body, r = { flag: flag, wheeks: [] }
    g.state.noHerdCascade = flag
    P.herdToCrossing()
    // the animal on dry ground just south of the middle of the herd
    let at = null
    for (let dz = 3; dz < 14 && !at; dz += 1) {
      const x = -34, z = -86 - dz
      if (P.terrainHeight(x, z) > P.waterLevel + 0.1) at = { x: x, z: z }
    }
    if (!at) at = { x: -34, z: -92 }
    r.at = at
    const put = () => { b.position.set(at.x, P.terrainHeight(at.x, at.z) + 0.6, at.z); b.velocity.set(0, 0, 0) }
    put()
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false)
    let to4 = 0, to9 = 0
    for (let w = 1; w <= 14; w++) {
      g.events.emit('capy:wheek', {})
      const c = P.cascade()
      r.wheeks.push({ w: w, following: c.following, took: c.last, trailing: c.trailing })
      if (!to4 && c.following >= 4) to4 = w
      if (!to9 && c.following >= 9) { to9 = w; break }
      for (let i = 0; i < 60; i++) { put(); g.tick(1 / 60, false) }
    }
    r.to4 = to4; r.to9 = to9
    return r
  }, flag)
  out.on = await run(false)
  out.off = await run(true)
  out.on2 = await run(false)
  // ---- the answers of one cascading call ---------------------------------
  out.replies = await page.evaluate(() => {
    const g = window.__capy, P = g.pantanal, b = g.capy.body
    g.state.noHerdCascade = false
    P.herdToCrossing()
    const at = { x: -34, z: -92 }
    b.position.set(at.x, P.terrainHeight(at.x, at.z) + 0.6, at.z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 3; i++) { g.events.emit('capy:wheek', {}); for (let k = 0; k < 60; k++) g.tick(1 / 60, false) }
    // hook the sfx and time the answers on the hand clock
    const heard = []
    const sfx0 = g.sfx
    let t = 0
    g.sfx = function (name, o) { if (name === 'wheek') heard.push({ t: +t.toFixed(3), pitch: o && o.pitch ? +o.pitch.toFixed(3) : null }); return sfx0.apply(this, arguments) }
    try {
      g.events.emit('capy:wheek', {})
      for (let k = 0; k < 90; k++) { g.tick(1 / 60, false); t += 1 / 60 }
    } finally { g.sfx = sfx0 }
    return { heard: heard, cascade: P.cascade() }
  })
  // ---- the look-up: five behind, the rest trail ------------------------
  out.lookup = await page.evaluate(() => {
    const g = window.__capy, P = g.pantanal, b = g.capy.body, r = {}
    g.state.noHerdCascade = false
    P.herdToCrossing()
    // dry ground: the animal where it arrived
    const at = { x: -34, z: -92 }
    const put = () => { b.position.set(at.x, P.terrainHeight(at.x, at.z) + 0.6, at.z); b.velocity.set(0, 0, 0) }
    put()
    P.herdFollow(5)                  // 0..4 on the line
    // four grazers 11-14 m west of the animal, clear of the line's 5 m
    const spots = [[-46, -92], [-47, -95], [-45, -89.5], [-48, -93.5]]
    r.dry = spots.map(s => +(P.terrainHeight(s[0], s[1]) - P.waterLevel).toFixed(2))
    for (let k = 0; k < 4; k++) P.herdAt(5 + k, spots[k][0], spots[k][1])
    for (let i = 0; i < 20; i++) { put(); g.tick(1 / 60, false) }
    g.events.emit('capy:wheek', {})
    r.after = P.cascade()
    r.rows0 = [5, 6, 7, 8].map(i => P.herdOne(i))
    // the one left over: how far from the animal, now and 6 s on
    const left = [5, 6, 7, 8].filter(i => P.herdOne(i).st !== 'follow')
    r.left = left
    const d = i => { const o = P.herdOne(i); return +Math.hypot(o.x - at.x, o.z - at.z).toFixed(2) }
    r.leftD0 = left.map(d)
    for (let i = 0; i < 180; i++) { put(); g.tick(1 / 60, false) }
    r.mid = P.cascade(); r.leftD3 = left.map(d)
    for (let i = 0; i < 240; i++) { put(); g.tick(1 / 60, false) }
    r.end = P.cascade(); r.leftD7 = left.map(d)
    r.rows7 = left.map(i => P.herdOne(i))
    return r
  })
  // ---- one real Q on the real clock, after three recruits --------------
  out.realQ = await page.evaluate(() => {
    const g = window.__capy, P = g.pantanal, b = g.capy.body
    g.state.noHerdCascade = false
    P.herdToCrossing()
    const at = { x: -34, z: -92 }
    b.position.set(at.x, P.terrainHeight(at.x, at.z) + 0.6, at.z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 3; i++) g.events.emit('capy:wheek', {})
    return P.cascade()
  })
  await page.waitForTimeout(1500)
  await page.keyboard.down('KeyQ'); await page.waitForTimeout(120); await page.keyboard.up('KeyQ')
  await page.waitForTimeout(1500)
  out.realQ2 = await page.evaluate(() => window.__capy.pantanal.cascade())
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
