async page => {
  // ---------------------------------------------------------------------------
  // qa/bodies-animals.js — WHAT IS THERE TO KNOCK OVER, AND WHAT IS THERE TO
  // BE FRIGHTENED BY? (ROADMAP-FUN, items 4e and 5d)
  //
  // 4e wants three body events on a person: stumble, sit down hard, and fall
  // in. It says "gate on `r.fig`", which is the LOCAL record — the
  // chapter-neutral cast in seventeen chapters — and two of its three clauses
  // are claims about what a local has:
  //
  //   "drops what they hold via physBarge"  — do locals hold anything?
  //   "stumble at a quay edge -> plunge"     — is any local near water?
  //
  // 5d wants every flock, dog and herd flush routed through localsReact. The
  // registry for that is `herdKinds` in systems.js and `game.herdDebug()` is
  // the read-only window on it, so the reachability question — how many
  // chapters have an animal at all, and is anybody standing near one — can be
  // answered without touching sixteen biome files.
  //
  // Live-filtered on `q.biome === live` throughout (B5's rule).
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

  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave',
                 'antarctic','monaco','hanoi']
  const rows = []
  for (const n of NAMES) {
    await page.evaluate((b) => { window.__capy.hud.cross(b) }, n)
    await page.waitForTimeout(9000)
    rows.push(await page.evaluate(() => {
      const g = window.__capy
      const live = g.biome.current
      // ---- the animals -------------------------------------------------
      let herd = null
      try { herd = g.herdDebug() } catch (e) { herd = { err: String(e) } }
      const kinds = (herd && herd.kinds) || []
      let animals = 0
      const spots = []
      for (const k of kinds) {
        animals += k.n | 0
        if (k.first) spots.push(k.first)
      }
      // ---- the people ---------------------------------------------------
      const locals = []
      for (const L of (g.locals || [])) {
        if (L && L.biome === live && L.fig) locals.push(L)
      }
      // Does a local hold anything? The field is not in the record literal, so
      // this is expected to be zero everywhere — and "expected" is why it is
      // being measured rather than asserted.
      let holding = 0
      for (const L of locals) if (L.heldProp) holding++
      const hasField = locals.length ? ('heldProp' in locals[0]) : null
      // ---- who is near an animal ----------------------------------------
      let nearAnimal = 0, closest = null
      for (const L of locals) {
        for (const s of spots) {
          const d = Math.hypot(L.x - s.x, L.z - s.z)
          if (closest === null || d < closest) closest = d
          if (d < 15) { nearAnimal++; break }
        }
      }
      // ---- and who is standing next to water ----------------------------
      // The same accessor systems.js uses for the live chapter's api, and the
      // same waterHeightAt/waterLevel fallback shared.js publishes.
      const api = live === 'sydney' ? g.env : g[live]
      const wat = (x, z) => {
        if (!api) return -400
        try {
          if (typeof api.waterHeightAt === 'function') {
            const y = api.waterHeightAt(x, z)
            if (typeof y === 'number' && y === y) return y
          }
        } catch (e) {}
        return (typeof api.waterLevel === 'number') ? api.waterLevel : -400
      }
      let byWater = 0, minEdge = null
      for (const L of locals) {
        // Eight probes on a 3 m ring: a person is "at an edge" when the ground
        // beside them is under the waterline.
        for (let a = 0; a < 8; a++) {
          const th = a * 0.785
          const px = L.x + Math.cos(th) * 3.0, pz = L.z + Math.sin(th) * 3.0
          // sysGroundY is not published on `game`, so the test is against the
          // PERSON'S OWN feet: water within three metres that sits between a
          // metre and a half below them and half a metre above is an edge you
          // could be knocked off. A crude ring, and it only has to answer
          // 'is this mechanic reachable in this chapter'.
          const wy = wat(px, pz)
          if (wy > -300 && wy > L.y - 1.5 && wy < L.y + 0.5) { byWater++; break }
        }
      }
      return { b: live, locals: locals.length, holding: holding,
               heldPropField: hasField,
               animals: animals, kinds: kinds.map(k => k.kind + ':' + k.n),
               nearAnimal: nearAnimal,
               closestPersonToAnimal: closest === null ? null : +closest.toFixed(1),
               byWater: byWater }
    }))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=bodies-animals.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
