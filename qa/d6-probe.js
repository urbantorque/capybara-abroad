async page => {
  // WHAT IS THE FLOOR AT A DOOR? — the instrument the exit board's placement
  // table was written from, and the answer is that there is no general one.
  //
  // For each of the nineteen chapters it prints every collider surface a
  // downward ray meets at the board's position and at the door's, plus the
  // height the animal actually comes to rest at when dropped on the door. That
  // last number is the truth and the other two are candidates.
  //
  // WHAT IT SHOWED, and every one of these is a `floorY` or an `at` in
  // sysBOARD_DRESS:
  //
  //   Uji      board [-3.87, -0.26, 3.16]   door [-3.93, 3.16]   rest 3.50
  //   the bridge deck is 3.16 and the bed of the river is -3.87. "The lowest
  //   surface at or above the terrain" — the rule that is right on open ground
  //   — puts the board in the river.
  //
  //   Sydney   board [-8, 0.17, 3.04]
  //   the 3.04 is the wharf shelter's ROOF. "The highest surface", the obvious
  //   other rule, puts the board on top of the shelter.
  //
  // Two rules, opposite failures, in two chapters. So the eight built doors —
  // a bridge over a river, a deck over water, a made street over a harbour —
  // carry their floor as a measured number, and the other eleven take the
  // automatic rule, which is right on the ground it was written for.
  //
  // The board's OWN collider shows up in these lists once it is planted, at
  // exactly b.y and b.y + topY. Both are ignorable.
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  for (let i = 0; i < KEYS.length; i++) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(KEYS[i])
    await page.waitForTimeout(8000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard()
      const w = g.hintTarget('__way')
      const scan = (x, z) => {
        const res = []
        try {
          g.world.raycastAll({ x: x, y: (b ? b.y : 0) + 40, z: z },
                             { x: x, y: (b ? b.y : 0) - 40, z: z },
                             { skipBackfaces: true }, h => {
            if (h.hasHit) res.push(+h.hitPointWorld.y.toFixed(2))
          })
        } catch (e) { return ['ERR'] }
        res.sort((p, q) => p - q)
        return res
      }
      return { biome: g.biome.current, by: b ? +b.y.toFixed(2) : null,
               atBoard: b ? scan(b.x, b.z) : [], atDoor: w ? scan(w.x, w.z) : [] }
    })
    // AND THE DROP HAS TO START LOW. Three metres above the board is above the
    // awnings on the Corso, and the animal landed on a surf shop and reported
    // a door floor of 5.65 with total confidence. It is dropped from just over
    // the board's own head, on the door.
    await page.evaluate(() => {
      const g = window.__capy
      const w = g.hintTarget('__way')
      const b = g.exitBoard()
      g.capy.body.position.set(w ? w.x : b.x, b.y + 1.4, w ? w.z : b.z)
      g.capy.body.velocity.set(0, 0, 0)
    })
    await page.waitForTimeout(2400)
    r.rest = await page.evaluate(() => +window.__capy.capy.position.y.toFixed(2))
    out.rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=d6-probe.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
