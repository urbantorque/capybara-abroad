async page => {
  const out = { rooms: {} }
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  // Digit1..9, Digit0, Minus, Equal, BracketLeft, BracketRight, Semicolon,
  // Quote, Comma, Period, Slash  ->  chapters 1..19. Venice is 10, Son Doong
  // is 16 and Monte Carlo is 18; the first run of this used Comma for Monaco
  // (which is Antarctica) and Period for the cave (which is Monte Carlo), and
  // the only reason it was caught is that the audit reports the room KEY.
  const CH = { venice: 'Digit0', cave: 'Quote', monaco: 'Period' }

  for (const [name, key] of Object.entries(CH)) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(5500)
    out.rooms[name] = await page.evaluate(async (n) => {
      const g = window.__capy
      const api = g[n]
      const before = g.hud.roomAudit()
      // Find the interior by asking the chapter, never by a literal.
      let ax = null, az = null
      if (n === 'venice') { ax = -4; az = -66 }
      if (n === 'cave') { ax = 0; az = -130 }
      if (n === 'monaco') {
        // the CENTRE of the casino, not the first cell of the scan: the edge
        // cell is one metre inside the rect and the animal slides off it.
        const hits = []
        // monCASINO sits at x 118, z 119 — well outside the -80..80 box the
        // first run searched, which is why it reported no zone at all.
        for (let x = 60; x <= 190; x += 2) {
          for (let z = 60; z <= 190; z += 2) {
            if (api && api.inZone && api.inZone('casino', x, z)) hits.push([x, z])
          }
        }
        if (hits.length) { const m = hits[Math.floor(hits.length / 2)]; ax = m[0]; az = m[1] }
      }
      if (ax === null) return { biome: g.biome.current, before: before, noZone: true }
      // ON THE FLOOR OF THE ROOM, not on the ground under it: the casino sits
      // at y 28 and the first run dropped the animal to the harbour, so the
      // zone test that had just passed at search time was false on arrival.
      let ay = g.capy.position.y + 1
      try { if (api && api.terrainHeight) ay = api.terrainHeight(ax, az) + 1.5 } catch (e) {}
      g.capy.body.position.set(ax, ay, az)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 7000))
      return { biome: g.biome.current, before: before, after: g.hud.roomAudit(),
               at: [ax, az], pos: [Math.round(g.capy.position.x), Math.round(g.capy.position.z)] }
    }, name)
  }

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p4-rooms.json', { method: 'POST', body: s })
  }, out)
}
