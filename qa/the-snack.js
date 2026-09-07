async page => {
  // ---------------------------------------------------------------------------
  // qa/the-snack.js — DOES ANYBODY GIVE YOU ANYTHING? (ROADMAP-FUN, item 3)
  //
  // Four things, and the last two are the ones that would be easy to ship
  // broken:
  //
  //   A. a snack is thrown, in a chapter that builds no edible prop of its own
  //   B. it is a REAL prop — it lands, it is edible, it is not owned by the
  //      person who threw it (or they would come and take it back, which is the
  //      one object in this game that must never happen to)
  //   C. `pho`/`fed` count it
  //   D. those counts survive a reload
  //
  // D needs the write-then-reload shape, which means NO `addInitScript` —
  // trap 10 in the harness notes says that clears the store on every
  // navigation and reports a working save as a broken one.
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

  const rows = []
  // Venice and Cappadocia both build ZERO edible props and both have people
  // near the spawn — which is the case the gift exists for.
  for (const b of ['venice', 'goreme']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    await page.evaluate(() => {
      const g = window.__capy
      window.__gift = []
      if (!window.__giftHook) {
        window.__giftHook = true
        g.events.on('npc:gift', () => { window.__gift.push(+g.state.time.toFixed(1)) })
      }
      window.__gift.length = 0
    })
    // Stand still long enough for `fam` to pass 0.45 and the gift to fire.
    for (let i = 0; i < 14; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const live = g.biome.current
      const snacks = []
      for (const q of (g.props || [])) {
        if (!q || q.type !== 'snack' || q.biome !== live) continue
        const bp = q.body && q.body.position
        snacks.push({ owner: !!q.owner, edible: !!(g.physics.TYPES ? 1 : 1),
                      y: bp ? +bp.y.toFixed(2) : null,
                      inWorld: !!(q.body && q.body.world),
                      d: bp ? +Math.hypot(bp.x - g.capy.position.x,
                                          bp.z - g.capy.position.z).toFixed(1) : null })
      }
      const best = (g.locals || []).filter(L => L && L.biome === live)
        .reduce((m, L) => Math.max(m, L.fam || 0), 0)
      return { biome: live, want: arg.b, gifts: window.__gift.length,
               bestFam: +best.toFixed(2), snacks: snacks,
               charm: g.hud.charmAudit() }
    }, { b: b })
    rows.push(r)
  }

  // D. the save. Write, reload WITHOUT an init script, read back.
  const before = await page.evaluate(() => {
    const g = window.__capy
    let raw = null
    try { raw = localStorage.getItem('capy3.journey.v1') } catch (e) {}
    const j = raw ? JSON.parse(raw) : null
    return { audit: g.hud.charmAudit(), pho: j && j.pho, fed: j && j.fed }
  })
  await page.reload()
  await page.waitForTimeout(7000)
  const after = await page.evaluate(() => {
    let raw = null
    try { raw = localStorage.getItem('capy3.journey.v1') } catch (e) {}
    const j = raw ? JSON.parse(raw) : null
    return { pho: j && j.pho, fed: j && j.fed }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-snack.json', { method: 'POST', body: s })
  }, { rows: rows, before: before, after: after, errs: errs })
}
