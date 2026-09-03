async page => {
  // THREE PICTURES THE COUNTERS CANNOT TAKE.
  //
  //  1. thirty silver gulls standing round a bag of chips on the Corso;
  //  2. a hundred and eighty pigeons doing the same to a sandwich in San Marco;
  //  3. somebody actually mid-swing — the Hanoi barber, whose beat is the
  //     shortest in the game at 2.4 s, photographed six times a second apart so
  //     that at least one frame catches the arm up.
  //
  // The camera is put on the subject with game.frameShot, which is the same
  // request every marquee makes; input.camYaw is an OUTPUT and writing it
  // photographs whatever the arrival left (D6b, trap 3).
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = {}

  async function chapter(key) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
  }

  // ---- 1. the Corso -------------------------------------------------------
  await chapter('BracketRight')
  await page.evaluate(() => {
    const g = window.__capy
    const c = g.capy.position
    g.physics.spawnProp('chips', c.x + 1.4, c.z + 1.4)
  })
  await page.waitForTimeout(12000)
  await page.evaluate(() => {
    const g = window.__capy
    g.frameShot({ yaw: 0.9, dist: 7.0, pitch: 0.16, raise: 1.1, hold: 4 })
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/d7s-manly-chips.png' })
  out.manly = await page.evaluate(() => window.__capy.flockDebug())

  // ---- 2. San Marco -------------------------------------------------------
  await chapter('Digit0')
  await page.evaluate(() => {
    const g = window.__capy
    const p = g.venice.piazza
    g.capy.body.position.set(p.x, g.venice.terrainHeight(p.x, p.z) + 0.6, p.z)
    g.capy.body.velocity.set(0, 0, 0)
    g.physics.spawnProp('sandwich', p.x + 2, p.z + 2)
  })
  await page.waitForTimeout(12000)
  await page.evaluate(() => {
    const g = window.__capy
    g.frameShot({ yaw: 2.3, dist: 6.0, pitch: 0.22, raise: 1.0, hold: 4 })
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/d7s-venice-seed.png' })
  out.venice = await page.evaluate(() => window.__capy.flockDebug())

  // ---- 3. the barber ------------------------------------------------------
  await chapter('Slash')
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.beatAudit().rows.filter(r => r.sfx === 'tick')[0]
    if (!b) return
    g.capy.body.position.set(b.x + 2.6, g.hanoi.terrainHeight(b.x + 2.6, b.z + 2.6) + 0.6,
                             b.z + 2.6)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(2500)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const g = window.__capy
      const b = g.beatAudit().rows.filter(r => r.sfx === 'tick')[0]
      if (b) g.frameShot({ yaw: Math.atan2(g.capy.position.x - b.x,
                                           g.capy.position.z - b.z),
                           dist: 4.0, pitch: 0.06, raise: 1.05, hold: 2.0 })
    })
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'qa/d7s-barber-' + (i + 1) + '.png' })
  }
  out.barber = await page.evaluate(() => {
    const g = window.__capy
    return { rows: g.beatAudit().rows, err: g.state.lastError || '' }
  })

  // ---- 4. and one of the five you can walk through ------------------------
  // The contact channel is the only one of the three pushes that a probe
  // cannot fake: `game.hang` measures the animal's own velocity, and writing
  // capy.body.velocity is deleted by capybara.js (see EXTERNAL FORCES). So it
  // is walked, with real keys, from four metres out.
  //
  // Hanoi hangs a two-metre strand of lanterns off its board, which puts the
  // bottom of it under a capybara's chin.
  await page.evaluate(() => {
    const g = window.__capy
    const h = g.hangAudit().rows[0]
    const b = g.exitBoard()
    if (!h || !b) return
    // Four metres back along the board's facing, aimed at it.
    const s = Math.sin(b.yaw), c = Math.cos(b.yaw)
    g.capy.body.position.set(h.x + s * 4.0, b.y + 0.5, h.z + c * 4.0)
    g.capy.body.velocity.set(0, 0, 0)
    window.__before = h.a
  })
  await page.waitForTimeout(2200)
  // A CLOSED LOOP, not a held key. Movement is camera-relative and
  // `input.camYaw` is an OUTPUT that drifts, so the WASD set has to be
  // recomputed from it every few frames or the animal walks off at a tangent.
  await page.keyboard.down('ShiftLeft')
  let held = ''
  for (let step = 0; step < 14; step++) {
    const want = await page.evaluate(() => {
      const g = window.__capy
      const h = g.hangAudit().rows[0]
      const c = g.capy.position
      if (!h) return ''
      let rel = Math.atan2(h.x - c.x, h.z - c.z) - (g.input.camYaw || 0)
      while (rel > Math.PI) rel -= 6.283185
      while (rel < -Math.PI) rel += 6.283185
      const a = Math.abs(rel)
      return a < 0.785 ? 'KeyW' : a > 2.356 ? 'KeyS' : rel > 0 ? 'KeyD' : 'KeyA'
    })
    if (want !== held) {
      if (held) await page.keyboard.up(held)
      if (want) await page.keyboard.down(want)
      held = want
    }
    await page.waitForTimeout(200)
  }
  await page.screenshot({ path: 'qa/d7s-hanoi-strand.png' })
  if (held) await page.keyboard.up(held)
  await page.keyboard.up('ShiftLeft')
  out.strand = await page.evaluate(() => {
    const g = window.__capy
    const h = g.hangAudit().rows[0]
    const c = g.capy.position
    return { before: window.__before, after: h ? h.a : null, v: h ? h.v : null,
             d: h ? +Math.hypot(h.x - c.x, h.z - c.z).toFixed(2) : null,
             err: g.state.lastError || '' }
  })

  await page.evaluate(o => fetch('/shot?name=d7-shots.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
