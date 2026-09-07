async page => {
  // ---------------------------------------------------------------------------
  // qa/animals-scare.js — DO THE ANIMALS MAKE PEOPLE JUMP? (item 5d)
  //
  // The event fires only for a LED animal that is MOVING, so the probe has to
  // actually recruit a herd and then walk it past somebody — a teleport past a
  // person produces no line and no followers.
  //
  // Recruiting is a wheek (`capy.can('herd')` gates it), and `game.herdDebug()`
  // says how many heard and how many are following, so the run can report
  // whether it managed to set the experiment up at all rather than reporting a
  // silent zero for a mechanic it never reached.
  //
  // The differential is against the same drive with the herd NOT recruited:
  // people flinch at the capybara for half a dozen other reasons and a raw
  // count of startles proves nothing on its own.
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
    window.__n = 0
    g.events.on('npc:startled', () => { window.__n++ })
    // The hook under test, wrapped so a call can be counted even when nobody
    // happens to be in range — "it fired and nobody was near" and "it never
    // fired" are different failures and look identical from the outside.
    // THE HERD SKILL IS EARNED IN CHAPTER 15 and `sysSKILLS` rewrites it from
    // the task table EVERY FRAME, so `capy.learn('herd', true)` is undone on
    // the next one. `can` is wrapped instead. This is the gate and not the
    // mechanic: recruiting, the obey tiers, the trail and the line all run
    // exactly as they do in a real game, and 5d's own event is downstream of
    // all of it. Worth writing down that the mechanic under test is invisible
    // until the Pantanal.
    const rawCan = g.capy.can.bind(g.capy)
    g.capy.can = (id) => (id === 'herd' ? true : rawCan(id))
    const raw = g.startlePeople
    window.__calls = 0
    g.startlePeople = function (x, z, s, r) {
      window.__calls++
      return raw.call(g, x, z, s, r)
    }
  })

  const rows = []
  for (const b of ['iceland', 'goreme', 'venice']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    const row = { b: b }

    // Walk the animal to the nearest herd animal, wheek, then walk at the
    // nearest person. Both legs are real keys.
    row.setup = await page.evaluate(() => {
      const g = window.__capy
      let d = null
      try { d = g.herdDebug() } catch (e) { return { err: String(e) } }
      const k = (d.kinds || [])[0]
      if (!k || !k.first) return { err: 'no animal' }
      const live = g.biome.current
      let best = null, bd = 1e9
      for (const L of (g.locals || [])) {
        if (!L || L.biome !== live || !L.fig) continue
        const dd = Math.hypot(L.x - k.first.x, L.z - k.first.z)
        if (dd < bd) { bd = dd; best = L }
      }
      window.__L = best
      window.__A = k.first
      return { kind: k.kind, n: k.n, animalAt: k.first,
               nearestPersonToAnimal: best ? +bd.toFixed(1) : null,
               canHerd: !!(g.capy.can && g.capy.can('herd')) }
    })
    if (row.setup.err || !row.setup.canHerd) { rows.push(row); continue }

    async function leg(recruit) {
      await page.evaluate((r) => {
        const g = window.__capy, A = window.__A
        // Stand on the animal so the wheek certainly reaches it.
        g.capy.body.position.set(A.x + 1.2, A.y + 0.6, A.z)
        g.capy.body.velocity.set(0, 0, 0)
        g.capy.body.previousPosition.copy(g.capy.body.position)
        g.capy.body.interpolatedPosition.copy(g.capy.body.position)
        window.__n = 0
        window.__calls = 0
      }, recruit)
      await page.waitForTimeout(1400)
      if (recruit) {
        // Three wheeks: obey tiers need more than one for some kinds.
        for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(1100) }
      }
      const led = await page.evaluate(() => {
        try { const d = window.__capy.herdDebug(); return d.total } catch (e) { return -1 }
      })
      // ...then walk at the person, so the line comes with you.
      await page.evaluate(() => {
        const g = window.__capy, L = window.__L
        if (!L) return
        const yaw = g.input.camYaw
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
        g.capy.body.position.set(L.x - fx * 14, L.y + 0.6, L.z - fz * 14)
        g.capy.body.velocity.set(0, 0, 0)
        g.capy.body.previousPosition.copy(g.capy.body.position)
        g.capy.body.interpolatedPosition.copy(g.capy.body.position)
        window.__n = 0
        window.__calls = 0
      })
      await page.waitForTimeout(1200)
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(4200)
      await page.keyboard.up('KeyW')
      await page.waitForTimeout(1200)
      return page.evaluate((l) => {
        const g = window.__capy
        return { led: l, calls: window.__calls, startled: window.__n,
                 following: (() => { try { return g.herdDebug().total } catch (e) { return -1 } })() }
      }, led)
    }

    row.without = await leg(false)
    row.with = await leg(true)
    rows.push(row)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=animals-scare.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
