async page => {
  // ---------------------------------------------------------------------------
  // qa/witness-break.js — IS A SPILL A THING SOMEBODY SAW? (item 4d)
  //
  // 4d's premise is that a spill and a shatter are "already a witnessed event",
  // so adding the flags to more types multiplies something that works. Read
  // from source that looks false in two different ways, and a source reading is
  // a guess until it is run:
  //
  //   - physSpill emits 'prop:impact' with speed === 0, and EVERY consumer of
  //     that event gates on speed — npcLOC_BANG, npcOWN_BANG, `> 3`, and
  //     systems.js's own `if (s < 1.5) return`, which is the line incAdd sits
  //     below. The one listener with no speed gate is hardcoded to `coffee`
  //     and `icecream` and sits behind biomeLive() — Sydney only.
  //   - physShatter emits 'prop:destroy', which one handler in the whole game
  //     listens to. It counts an incident. It startles nobody.
  //
  // So: force each, next to a person, in Sydney and in a chapter that is not
  // Sydney, and count what comes back out.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  await page.evaluate(() => {
    const g = window.__capy
    const W = window
    W.__n = { startled: 0, chase: 0, impact: 0, destroy: 0, moment: 0 }
    g.events.on('npc:startled', () => W.__n.startled++)
    g.events.on('npc:chase', () => W.__n.chase++)
    g.events.on('prop:impact', () => W.__n.impact++)
    g.events.on('prop:destroy', () => W.__n.destroy++)
    // The incident card is DOM, and the roadmap's own note says to watch it
    // with a MutationObserver rather than by wrapping toast() — which is
    // module-local and sees nothing.
    const mo = new MutationObserver(ms => {
      for (const m of ms) for (const nd of m.addedNodes) {
        const t = (nd.textContent || '')
        if (/AN INCIDENT|A SCENE/.test(t)) W.__n.moment++
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    W.__reset = () => { for (const k in W.__n) W.__n[k] = 0 }
  })

  // `what` is 'spill' or 'shatter'; the prop is put at the feet of the nearest
  // person so there is no question of it being out of earshot.
  async function fire(what) {
    const put = await page.evaluate((w) => {
      const g = window.__capy
      const live = g.biome.current
      const cp = g.capy.position
      // TWO CASTS, AND THE FIRST CUT ONLY LOOKED AT ONE. `game.locals` is
      // npc.js's chapter-neutral list; Sydney's people are the `humans` cast
      // and reach the outside world as `game.npcs`, which carries no biome
      // field because it belongs to exactly one chapter. Reading only
      // `locals` reported "nobody" in the chapter with the most people in it.
      // `peopleNear` is a COUNT, not a list, so it cannot answer "where".
      const cands = []
      for (const L of (g.locals || [])) {
        if (L && L.biome === live && L.fig) cands.push({ x: L.x, z: L.z, y: L.y, c: 'local' })
      }
      if (live === 'sydney') {
        for (const h of (g.npcs || [])) {
          if (h && h.group && h.group.visible) {
            cands.push({ x: h.group.position.x, z: h.group.position.z,
                         y: h.group.position.y, c: 'human' })
          }
        }
      }
      let best = null, bd = 1e9
      for (const L of cands) {
        const d = Math.hypot(L.x - cp.x, L.z - cp.z)
        if (d < bd) { bd = d; best = L }
      }
      if (!best) return { err: 'nobody', nCast: cands.length }
      // Stand next to them, so `mine` in localsReact can be true and so the
      // incident chain has the animal at the scene.
      g.capy.body.position.set(best.x + 1.6, best.y + 0.6, best.z)
      g.capy.body.velocity.set(0, 0, 0)
      const type = w === 'spill' ? 'coffee' : 'cuencobowl'
      const pr = g.physics.spawnProp(type, best.x + 1.0, best.z, best.y + 0.4)
      if (!pr) return { err: 'no prop ' + type }
      // `disturbed` is props.js's causation stamp — a bin that blew over on its
      // own is not a thing you did, and incAdd reads it. Set it so the test is
      // of the WITNESS and not of the causation gate.
      pr.disturbed = true
      window.__pr = pr
      return { d: +bd.toFixed(1), type: type, cast: best.c,
               nNear: g.peopleNear(cp.x, cp.z, 30) }
    }, what)
    if (put.err) return put
    // THE PROP'S OWN LANDING IS AN IMPACT. The first cut reset the counters
    // 400 ms after spawning it and read startled:1 off a coffee cup hitting
    // the pavement, not off the spill. Let it settle, then arm.
    await page.waitForTimeout(2500)
    await page.evaluate(() => { window.__reset() })
    await page.evaluate((w) => {
      const g = window.__capy
      if (w === 'spill') g.physics.spill(window.__pr)
      else g.physics.shatter(window.__pr)
    }, what)
    await page.waitForTimeout(2500)
    // ...and then three more of the same, close together, because one
    // witnessed thing is not an incident: sysINC_N is a CHAIN. If incAdd is
    // being reached at all, the fourth of these pays out a card.
    for (let k = 0; k < 3; k++) {
      await page.evaluate((w) => {
        const g = window.__capy
        const cp = g.capy.position
        const pr = g.physics.spawnProp(w === 'spill' ? 'coffee' : 'cuencobowl',
                                       cp.x + 0.8, cp.z, cp.y + 0.3)
        if (!pr) return
        pr.disturbed = true
        if (w === 'spill') g.physics.spill(pr); else g.physics.shatter(pr)
      }, what)
      await page.waitForTimeout(1200)
    }
    const n = await page.evaluate(() => Object.assign({}, window.__n))
    return Object.assign({ what: what }, put, n)
  }

  const rows = []
  for (const b of ['sydney', 'venice']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    rows.push(Object.assign({ b: b }, await fire('spill')))
    await page.waitForTimeout(1500)
    rows.push(Object.assign({ b: b }, await fire('shatter')))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=witness-break.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
