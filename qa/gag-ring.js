async page => {
  // ---------------------------------------------------------------------------
  // qa/gag-ring.js — CAN THE CHAIN ARM WHERE YOU LAND? (ROADMAP-FUN, item 2)
  //
  // Item 2 wants one authored gag per spawn ring, "and every one is a witnessed
  // event so the chain arms from the first thing you touch". That is two
  // conditions, not one, and only the second is interesting:
  //
  //   1. something loose within reach of the spawn, and
  //   2. SOMEBODY WITHIN `sysINC_SEE` (16 m) OF IT.
  //
  // `incAdd` refuses outright when `findPeople` answers zero — it is why the
  // Drift can never produce an incident however much is thrown off how many
  // islands — so a spawn ring full of bins with nobody near them arms nothing.
  // B4 counted props and people separately, which cannot see that. This pairs
  // them.
  //
  //   loose    props within 16 m of spawn with a movable body
  //   armable  ...of those, how many have a person within 16 m of the PROP
  //   nearest  distance to the nearest armable one
  // ---------------------------------------------------------------------------
  const ORDER = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const p = g.capy.position
      const live = g.biome.current
      const SEE = 16, RING = 16
      // Everybody who counts as a witness, in the two shapes npc.js keeps them.
      const eyes = []
      for (const q of (g.npcs || [])) {
        const gp = q && q.group && q.group.position
        if (gp) eyes.push({ x: gp.x, z: gp.z })
      }
      for (const L of (g.locals || [])) {
        if (L && L.biome === live) eyes.push({ x: L.x, z: L.z })
      }
      function seen(x, z) {
        for (const e of eyes) if (Math.hypot(e.x - x, e.z - z) < SEE) return true
        return false
      }
      const loose = [], armable = []
      for (const q of (g.props || [])) {
        const bp = q && q.body && q.body.position
        if (!bp) continue
        // ---- ONLY THIS CHAPTER'S (measured, and it invalidated a whole run)
        // `game.props` ACCUMULATES: after one crossing it held 49 Sydney props
        // and 17 Pantanal ones, and every chapter's spawn is near the origin,
        // so an unfiltered ring counts the props of every chapter visited so
        // far standing in the same coordinates. The tell was two chapters
        // returning byte-identical prop lists — Sơn Đoòng reporting the
        // Pantanal's beach towels, and Cappadocia reporting Manly's thongs.
        // `q.biome` is on the record; `q.body.world` is the second half of the
        // same question, because a detached chapter's bodies leave the world.
        if (q.biome !== live) continue
        if (!q.body.world) continue
        const d = Math.hypot(bp.x - p.x, bp.z - p.z)
        if (d > RING) continue
        // A movable thing. Mass 0 is scenery you cannot knock over, and
        // `planted` is props.js's own mark for a thing rooted in place.
        if (!(q.body.mass > 0) || q.planted) continue
        loose.push({ t: q.type, d: +d.toFixed(1) })
        if (seen(bp.x, bp.z)) armable.push({ t: q.type, d: +d.toFixed(1) })
      }
      armable.sort((a, c) => a.d - c.d)
      loose.sort((a, c) => a.d - c.d)
      return { biome: live, want: arg.b,
               eyes: eyes.filter(e => Math.hypot(e.x - p.x, e.z - p.z) < 26).length,
               loose: loose.length, armable: armable.length,
               nearest: armable.length ? armable[0] : null,
               types: loose.slice(0, 6).map(q => q.t + '@' + q.d) }
    }, { b: b })
    rows.push(r)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=gag-ring.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
