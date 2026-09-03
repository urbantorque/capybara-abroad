async page => {
  // D6, SECOND SESSION: IS THERE ANYTHING STANDING AT THE DOOR?
  //
  // Nineteen chapters, one question each, and the whole point of the batch is
  // that the answer used to be "no" in all nineteen: `way` was a point, a
  // sentence, a mark on the chart and an arrow on the paper, and nothing in
  // the world at all.
  //
  // FIVE THINGS MEASURED, and only the first is about the code existing:
  //
  //   PLANTED. game.exitBoard() answers in every chapter, with a collider, in
  //   the dressing that chapter's row asks for. Six of the nineteen doors are
  //   a getter on the biome's own api and those are the ones a plant on
  //   `biome:enter` would have missed, so a sweep that only visits Sydney
  //   proves nothing.
  //
  //   AT THE DOOR AND NOT IN IT. Distance from the board to the point the
  //   arrow points at: it must be about sysBOARD_SIDE (2.2 m) — near enough
  //   to be the same place, far enough that it is not standing in the doorway
  //   the three wheeks are answered in.
  //
  //   STANDING ON SOMETHING. A DROP TEST, not a comparison against
  //   terrainHeight: the board is PLACED at terrainHeight, so measuring it
  //   against terrainHeight is a tautology that would report nineteen perfect
  //   scores over a board buried under a jetty deck, a paved campo or a metre
  //   of Venetian pavement. The animal is dropped beside the board and where
  //   it comes to rest is the true floor there.
  //
  //   IN THE PICTURE. Nineteen photographs from the door, which is the only
  //   thing that can say whether a board is inside a wall, facing a cliff or
  //   turned the wrong way round. Every placement override in sysBOARD_DRESS
  //   was one of these before it was a number.
  //
  //   THE CARD COMES OUT OF IT. Three wheeks at a real door, and then: does a
  //   shot fire, does the card carry `from`, and does its transform-origin
  //   land on the board's own position on the screen. An origin that is not
  //   within a few pixels of the board is a card growing from somewhere else.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [], errs: [] }

  // Trap 15 in the harness note: nineteen chapters, and the mapping past nine
  // is not obvious. Every row asserts the biome it actually landed in.
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(2000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  // ONE RELOAD PER CHAPTER, and the first build of this file did not do that.
  // The nineteen picker keys are the TITLE CARD's; in play, Digit1..Digit9 do
  // nothing at all and `Slash` — chapter 19's key — is bound to the help card.
  // So the sweep pressed nineteen keys, opened the journal on the last one and
  // filed nineteen identical Sydney rows under nineteen chapter names, with
  // every number in them correct. A sweep that does not assert the biome it
  // landed in cannot tell that from a working run (harness trap 15).
  for (let i = 0; i < KEYS.length; i++) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(KEYS[i])
    // Eight seconds, because a chapter takes about that long to ARRIVE: the
    // arrival shot alone is 3.6 s and the biome's own build finishes inside
    // it. A probe that reads at 2 s measures a half-built world.
    await page.waitForTimeout(8000)

    // 1. what is standing there, and where the door is
    const row = await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard ? g.exitBoard() : null
      const w = g.hintTarget ? g.hintTarget('__way') : null
      const api = g.biome && (g.biome.current === 'sydney' ? g.env : g[g.biome.current])
      const r = { biome: g.biome ? g.biome.current : '?', board: !!b }
      if (!b) return r
      r.x = +b.x.toFixed(2); r.y = +b.y.toFixed(2); r.z = +b.z.toFixed(2)
      r.yaw = +b.yaw.toFixed(2); r.body = b.body; r.top = +b.topY.toFixed(2)
      if (w) {
        r.door = +Math.sqrt((b.x - w.x) * (b.x - w.x) + (b.z - w.z) * (b.z - w.z)).toFixed(2)
        // Does the door itself carry a height? Six of the nineteen resolve
        // through a published fixture and only a fixture has one.
        r.doorY = (typeof w.y === 'number' && w.y === w.y) ? +w.y.toFixed(2) : null
      }
      r.terrain = (api && typeof api.terrainHeight === 'function')
        ? +api.terrainHeight(b.x, b.z).toFixed(2) : null
      r.bodies = g.world ? g.world.bodies.length : 0
      return r
    })

    // 2. THE DROP TEST, AT THE DOOR ITSELF.
    //
    // The first version dropped the animal 1.8 m out along the board's face
    // normal, and the probe was part of the experiment: 1.8 m in front of the
    // Palawan board is off the end of the jetty, 1.8 m in front of Pasto's is
    // down the outside of a crater, and both filed a board hanging in the air
    // against a board that is standing on the ground. The question is not
    // "what is under a point near the board", it is "is the board's foot level
    // with the floor the player stands on to use it" — so it is dropped on the
    // door, which is the one place in the chapter a player is guaranteed to
    // stand, 2.2 m away.
    row.stand = await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard ? g.exitBoard() : null
      const w = g.hintTarget ? g.hintTarget('__way') : null
      if (!b) return null
      g.capy.body.position.set(w ? w.x : b.x, b.y + 3.0, w ? w.z : b.z)
      g.capy.body.velocity.set(0, 0, 0)
      return null
    })
    await page.waitForTimeout(2200)
    const settle = await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard ? g.exitBoard() : null
      return b ? +(g.capy.position.y - b.y).toFixed(2) : null
    })
    row.stand = settle

    // 3. AT THE DOOR, LOOKING AT IT. The animal goes to the door itself and
    // the rig is snapped behind it, which is the frame a player arrives in.
    await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard ? g.exitBoard() : null
      const w = g.hintTarget ? g.hintTarget('__way') : null
      if (!b) return
      const api = g.biome && (g.biome.current === 'sydney' ? g.env : g[g.biome.current])
      const px = w ? w.x : b.x, pz = w ? w.z : b.z
      const ty = (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(px, pz) : 0
      g.capy.body.position.set(px, Math.max(ty, b.y) + 0.9, pz)
      g.capy.body.velocity.set(0, 0, 0)
    })
    await page.waitForTimeout(1200)
    // ...and then IN FRONT OF THE FACE, which the first two versions of this
    // never were. The camera was put on the line board -> animal, and the
    // animal is at the door, and the board stands at right angles to that line
    // by construction — so nineteen chapters were photographed EDGE ON and
    // thirteen of them read as a post with nothing on it. The board's own
    // facing is the only bearing this picture can be taken from.
    await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard()
      if (!b) return
      const nx = Math.sin(b.yaw), nz = Math.cos(b.yaw)
      const api = g.biome && (g.biome.current === 'sydney' ? g.env : g[g.biome.current])
      const x = b.x + nx * 3.4, z = b.z + nz * 3.4
      const ty = (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(x, z) : 0
      g.capy.body.position.set(x, Math.max(ty, b.y) + 0.8, z)
      g.capy.body.velocity.set(0, 0, 0)
    })
    // AND THE CAMERA IS ASKED, NOT SET. The first version wrote
    // `input.camYaw`, which is an OUTPUT — the rig's own damped angle, written
    // every frame — so four chapters photographed whatever the arrival left
    // the lens pointing at and two of them reported the board behind the
    // camera. game.frameShot is the channel that exists for this, and it is
    // the same one the game itself uses to turn onto the board.
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard()
      const p = g.capy.position
      if (!b) return
      g.frameShot({ yaw: b.yaw, dist: 6.5, pitch: 0.20, raise: 1.5, hold: 9 })
    })
    await page.waitForTimeout(2600)
    row.shot = await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard ? g.exitBoard() : null
      if (!b || !b.screen) return null
      // On screen at all, and where. Off the edges is a board the player
      // standing at the door cannot see.
      return { x: Math.round(b.screen.x), y: Math.round(b.screen.y),
               onScreen: b.screen.x > 0 && b.screen.x < 1280 &&
                         b.screen.y > 0 && b.screen.y < 760 }
    })
    await page.screenshot({ path: 'qa/d6b-' + (i + 1) + '-' + row.biome + '.png' })
    out.rows.push(row)
  }

  // ---- THE TILES TURN OVER ------------------------------------------------
  // Twelve seconds beside a board at about five turns a minute each. The
  // count comes off the instanced matrix's own version counter, which moves
  // only when a tile is mid-flip.
  const flip = await page.evaluate(() => {
    const g = window.__capy
    const b = g.exitBoard ? g.exitBoard() : null
    if (!b) return null
    let mesh = null
    g.scene.traverse(o => {
      if (o.isInstancedMesh && o.count === (b.rows * b.flaps)) mesh = o
    })
    return mesh ? { found: true, count: mesh.count, v: mesh.instanceMatrix.version } : { found: false }
  })
  await page.waitForTimeout(12000)
  out.flip = await page.evaluate(prev => {
    const g = window.__capy
    const b = g.exitBoard ? g.exitBoard() : null
    let mesh = null
    if (b) g.scene.traverse(o => { if (o.isInstancedMesh && o.count === (b.rows * b.flaps)) mesh = o })
    return { before: prev, after: mesh ? mesh.instanceMatrix.version : null,
             tiles: b ? b.rows * b.flaps : 0 }
  }, flip)

  // ---- THE CARD COMES OUT OF THE BOARD -------------------------------------
  // Sydney's wharf, because it is the one door in the game a player reaches
  // without doing anything first, and it is ungated.
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8000)
  await page.evaluate(() => {
    const g = window.__capy
    // The seaward third of the wharf deck — the exit zone in systems.js.
    g.capy.body.position.set(-40, 1.2, -21)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(2500)
  const pre = await page.evaluate(() => {
    const g = window.__capy
    const b = g.exitBoard ? g.exitBoard() : null
    return { framing: g.framing ? +g.framing().toFixed(3) : null,
             board: b ? { x: Math.round(b.screen ? b.screen.x : -1),
                          y: Math.round(b.screen ? b.screen.y : -1) } : null,
             prompt: !!document.querySelector('.capyui-home.show') }
  })
  // Three wheeks, real key events, at a real clock.
  for (let k = 0; k < 3; k++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(240) }
  // ...and read the frame the shot is in, BEFORE the card lands.
  const mid = await page.evaluate(() => {
    const g = window.__capy
    return { framing: g.framing ? +g.framing().toFixed(3) : null,
             cardUp: !!document.querySelector('.capyui-jr.show') }
  })
  // Long enough for the card's own dSlow entrance to finish: the offset that
  // matters is the one at REST, because the world is paused the moment the
  // card opens and the board does not move again.
  await page.waitForTimeout(1800)
  out.open = await page.evaluate(o => {
    const g = window.__capy
    const el = document.querySelector('.capyui-jr')
    const card = document.querySelector('.capyui-jrcard')
    const b = g.exitBoard ? g.exitBoard() : null
    const r = card ? card.getBoundingClientRect() : null
    const org = card ? getComputedStyle(card).transformOrigin : ''
    let dx = null, dy = null
    if (r && org && b && b.screen) {
      const p = org.split(' ')
      dx = Math.round(r.left + parseFloat(p[0]) - b.screen.x)
      dy = Math.round(r.top + parseFloat(p[1]) - b.screen.y)
    }
    return { pre: o.pre, mid: o.mid,
             shown: !!(el && el.classList.contains('show')),
             from: !!(el && el.classList.contains('from')),
             origin: org, offX: dx, offY: dy,
             depart: !!document.querySelector('.capyui-jrrow.go') }
  }, { pre: pre, mid: mid })
  await page.screenshot({ path: 'qa/d6b-card.png' })

  // ...and the fallback: Escape, then Tab, which must be the card as it was.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(900)
  out.tab = await page.evaluate(() => {
    const el = document.querySelector('.capyui-jr')
    const card = document.querySelector('.capyui-jrcard')
    return { shown: !!(el && el.classList.contains('show')),
             from: !!(el && el.classList.contains('from')),
             origin: card ? getComputedStyle(card).transformOrigin : '' }
  })

  out.errs = errs.slice(0, 12)
  out.lastError = await page.evaluate(() => (window.__capy.state.lastError || '') + '')
  await page.evaluate(o => {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))
    return fetch('/shot?name=d6-board.json', { method: 'POST', body: b })
  }, out)
}
