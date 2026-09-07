async page => {
  // ---------------------------------------------------------------------------
  // qa/the-poster.js — DOES THE PLACE PUT ONE UP? (ROADMAP-FUN item 6, B15)
  //
  //   1. NOT BELOW TIER 3. A poster at tier 0 is a poster that means nothing.
  //   2. ONE PER ARRIVAL, from tier 3, in every chapter — including the four
  //      whose spawn has nobody near it, because the poster is the world's
  //      opinion and not a person's.
  //   3. IT IS ON THE FLOOR. boardFloor is asked at four bearings; a chapter
  //      that drops you on a jetty, a crater rim or the sea must not get one
  //      buried or floating. Measured as the gap between the prop's resting y
  //      and the ground under it.
  //   4. TAKING IT IS A FIND, and it is a SEPARATE listener from red-handed —
  //      which returns early once that find is done, and most players who
  //      reach tier 3 have long since been caught stealing something.
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

  const out = {}
  const count = () => page.evaluate(() => {
    const g = window.__capy
    const ps = (g.props || []).filter(p => p && p.type === 'poster' && !p.removed)
    const cp = g.capy.position
    return { n: ps.length, at: ps.map(p => ({
      x: +p.body.position.x.toFixed(1), y: +p.body.position.y.toFixed(2),
      z: +p.body.position.z.toFixed(1),
      d: +Math.hypot(p.body.position.x - cp.x, p.body.position.z - cp.z).toFixed(1) })) }
  })

  // ---- 1: below the tier, nothing ----------------------------------------
  await page.evaluate(() => { window.__capy.hud.forceNoto(2, 0, 1, 0, 0) })
  await page.evaluate(() => { window.__capy.hud.cross('kyoto') })
  await page.waitForTimeout(11000)
  out.tier1 = { tier: await page.evaluate(() => window.__capy.hud.notoAudit().tier),
                posters: await count() }

  // ---- 2 + 3: from tier 3, six chapters, and where it lands --------------
  await page.evaluate(() => { window.__capy.hud.forceNoto(20, 6, 8, 0, 0) })
  const rows = []
  for (const b of ['cali', 'venice', 'antarctic', 'cave', 'kowloon', 'manly']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      const ps = (g.props || []).filter(p => p && p.type === 'poster' && !p.removed &&
                                             p.biome === g.biome.current)
      const all = (g.props || []).filter(p => p && p.type === 'poster' && !p.removed)
      const cp = g.capy.position
      const p0 = all[0]
      let sink = null
      if (p0) {
        // How far the resting body is from the ground under it. The prop's
        // own half-height is 0.7, so a poster standing on the floor reads
        // near zero and a buried or floating one does not.
        const gy = (g.biome && typeof g.biome.groundY === 'function')
          ? g.biome.groundY(p0.body.position.x, p0.body.position.z) : null
        if (gy !== null && gy === gy) sink = +(p0.body.position.y - gy).toFixed(2)
      }
      return { b: n, mine: ps.length, total: all.length, sink: sink,
               d: p0 ? +Math.hypot(p0.body.position.x - cp.x,
                                   p0.body.position.z - cp.z).toFixed(1) : null }
    }, b))
  }
  out.rows = rows

  // ---- 4: take it ---------------------------------------------------------
  out.take = await page.evaluate(async () => {
    const g = window.__capy
    // red-handed first, so the shared-listener bug this is guarding against
    // would actually bite: it returns early once that find is done.
    g.forceHeat && g.forceHeat(g.capy.position.x, g.capy.position.z, 1)
    const p = (g.props || []).find(x => x && x.type === 'poster' && !x.removed)
    if (!p) return { err: 'no poster to take' }
    g.capy.body.position.set(p.body.position.x + 0.5, p.body.position.y + 0.4,
                             p.body.position.z)
    g.capy.body.velocity.set(0, 0, 0)
    await new Promise(r => setTimeout(r, 400))
    const ok = g.physics.grab(p)
    await new Promise(r => setTimeout(r, 1500))
    return { grabbed: !!ok, held: g.capy.heldProp === p,
             found: g.hud.isFound ? g.hud.isFound('took-the-poster') : null,
             noticed: g.hud.noticed ? g.hud.noticed() : null }
  })
  await page.waitForTimeout(2000)
  out.takeAfter = await page.evaluate(() => {
    let a = null
    try { a = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}') } catch (e) {}
    return { finds: (a && a.finds) || [] }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-poster.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs.slice(0, 6), errN: errs.length }, out))
}
