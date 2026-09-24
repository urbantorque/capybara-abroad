async page => {
  // T3b, Act III in Kyoto (qaRivalAct 3, grace cut: the chase is the subject, not the gate).
  // A. A keepsake put down as sysDropKeep does, 'story:memory' on the bus: it comes, hops off,
  //    looks back, runs. The animal chases (WASD + Shift on window, closed loop off the lens,
  //    hand clock) until it is caught. Checks: looks > 0, the keepsake falls, is loose
  //    (dynamic, not frozen, grabbable) and lies inside 30 m of the snatch point.
  // B. The same with nobody chasing: it tires, and the keepsake is still inside 30 m.
  // C. A second memory in chapter 4 does not bring it back (once per chapter).
  const NAME = 'ten-t3b-chase'
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome.current === 'kyoto'))) {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5192/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() })
    await page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 })
    await page.keyboard.down('Shift'); await page.waitForTimeout(40); await page.keyboard.up('Shift')
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'kyoto') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('kyoto') }); await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(() => {
    const g = window.__capy; g.state.qaRivalAct = 3; g.state.noFirstGrace = true
    window.__rv = []; for (const n of ['rival:stole', 'rival:dropped', 'rival:escaped']) g.events.on(n, e => window.__rv.push({ n, how: e && e.how, keep: !!(e && e.keep) }))
    // the harness's keys: window keydown/keyup, the same listener the real ones reach
    window.__k = new Set()
    window.__keys = want => {
      for (const c of [...window.__k]) if (!want.has(c)) { dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })); window.__k.delete(c) }
      for (const c of want) if (!window.__k.has(c)) { dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, shiftKey: c === 'ShiftLeft' })); window.__k.add(c) }
    }
    window.__shot = async n => { g.renderer.render(g.scene, g.camera); await fetch('/shot?name=' + n, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] }) }
  })
  const run = async (o) => page.evaluate(async o => {
    const g = window.__capy, T = g.THREE, p = g.capy.position
    // wait out whatever visit is on
    for (let i = 0; i < 400 && g.rivalAudit().state !== 'off'; i++) g.tick(1 / 30, false)
    window.__rv.length = 0
    const a0 = g.capy.group.rotation.y + 0.7
    const k = g.physics.spawnKeep(o.place, p.x + Math.sin(a0) * 0.9, p.z + Math.cos(a0) * 0.9, p.y - 0.32)
    for (let i = 0; i < 30; i++) g.tick(1 / 30, false)
    g.events.emit('story:memory', { chapter: o.ch, act: 3, got: 1 })
    const pend = g.rivalAudit().keepPend
    g.rivalSoon()
    const r = { pend, seen: [], looks: 0, bursts: 0, t: 0, shots: [] }
    let wasLook = false, from = null, dmin = 99
    const cd = new T.Vector3()
    for (let i = 0; i < 1500; i++) {
      const a = g.rivalAudit()
      if (r.seen[r.seen.length - 1] !== a.state) r.seen.push(a.state)
      if (a.keepFrom) from = a.keepFrom
      if (a.look && !wasLook) { r.looks++; if (r.looks === 1 && o.chase) { await window.__shot(o.name + '-look'); r.shots.push('look@' + r.t.toFixed(1)) } }
      wasLook = a.look
      if (a.state === 'krun') r.t += 1 / 30
      if (o.chase && a.at && (a.state === 'krun' || a.state === 'in')) {
        g.camera.getWorldDirection(cd); cd.y = 0; cd.normalize()
        const dx = a.at[0] - p.x, dz = a.at[2] - p.z, d = Math.hypot(dx, dz) || 1
        if (r.t > 1.4) dmin = Math.min(dmin, d)
        const f = (dx * cd.x + dz * cd.z) / d, s = (dx * -cd.z + dz * cd.x) / d
        const want = new Set(['ShiftLeft'])
        if (f > 0.2) want.add('KeyW'); else if (f < -0.5) want.add('KeyS')
        if (s > 0.2) want.add('KeyD'); else if (s < -0.2) want.add('KeyA')
        if (a.state === 'krun' && r.t > 0.6) window.__keys(want)   // a player's reaction
        if (a.state === 'krun' && r.t > 1.2 && r.t < 1.25 && o.chase) { await window.__shot(o.name + '-run'); r.shots.push('run') }
      }
      g.tick(1 / 30, false)
      if (window.__rv.length && window.__rv[window.__rv.length - 1].n === 'rival:dropped') break
      if (a.state === 'out' && r.t > 0) break
    }
    window.__keys(new Set())
    r.ev = window.__rv.slice(-2)
    r.dmin = +dmin.toFixed(1)
    // the fall: a frame just after, then settle a second and a half
    for (let i = 0; i < 6; i++) g.tick(1 / 30, false)
    if (o.chase) await window.__shot(o.name + '-fall')
    for (let i = 0; i < 45; i++) g.tick(1 / 30, false)
    const kp = g.physics.keepOut(o.place), b = kp.body.position
    r.keep = { type: kp.body.type, frozen: !!kp.frozen, grabbable: kp.grabbable, collide: kp.body.collisionResponse,
               at: [+b.x.toFixed(1), +b.y.toFixed(2), +b.z.toFixed(1)], fromSnatch: from ? +Math.hypot(b.x - from[0], b.z - from[1]).toFixed(1) : null,
               toAnimal: +Math.hypot(b.x - p.x, b.z - p.z).toFixed(1), ground: +g.groundY(b.x, b.z).toFixed(2) }
    r.t = +r.t.toFixed(1)
    return r
  }, o)
  out.A = await run({ place: 'kyoto', ch: 4, chase: true, name: NAME })
  out.B = await run({ place: 'hanoi', ch: 19, chase: false, name: NAME })
  out.C = await page.evaluate(() => { const g = window.__capy; g.events.emit('story:memory', { chapter: 4, act: 3, got: 2 }); return g.rivalAudit().keepPend })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
