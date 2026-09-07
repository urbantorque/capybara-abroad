async page => {
  // ---------------------------------------------------------------------------
  // qa/gossip-cast.js — AND IS THERE ANYBODY IN THE CHAPTER AT ALL? (B15)
  //
  // gossip-premise.js measured earshot AT THE SPAWN and got 12 of 19. That is
  // the wrong question if the line is ARMED on arrival and spent the first
  // time somebody is close enough, rather than said on the doorstep — and
  // armed is plainly the better design, because it does not require the
  // chapter to have put a person at its own front door.
  //
  // So: how many chapters have anybody at all, and how far is the nearest one
  // from where you land? A chapter with people 40 m away will pay the line
  // within a minute of walking. A chapter with nobody never will, and it
  // needs to be counted rather than hoped about.
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

  // THE IDS, NOT THE NAMES. The first cut used 'marrakech', 'reef', 'balloon'
  // and 'raft' — which are what those chapters are CALLED. The ids are
  // 'sahara', 'palawan', 'goreme' and 'pantanal', and hud.cross on a name
  // that is not an id rolls straight back into the chapter you were already
  // in: four rows of 0 locals and 38 Sydney ghosts, which reads exactly like
  // four chapters with nobody in them.
  const BIOMES = ['quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift',
                  'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                  'cave', 'antarctic', 'monaco', 'hanoi', 'pasto', 'sydney']
  const rows = []
  for (const b of BIOMES) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(9000)
    rows.push(await page.evaluate((n) => {
      const g = window.__capy, p = g.capy.position
      // Everybody in this chapter who could ever speak, and the nearest one.
      let n1 = 0, near = 1e9, speakers = 0
      for (const L of (g.locals || [])) {
        if (!L || L.biome !== n) continue
        n1++
        if (L.fig && L.anchor && typeof L.anchor.speak === 'function') speakers++
        const d = Math.hypot(L.x - p.x, L.z - p.z)
        if (d < near) near = d
      }
      let n2 = 0
      for (const h of (g.npcs || [])) {
        if (!h || !h.group) continue
        n2++
        const d = Math.hypot(h.group.position.x - p.x, h.group.position.z - p.z)
        if (d < near) near = d
      }
      return { b: n, locals: n1, speakers: speakers, npcs: n2,
               nearest: near < 1e9 ? +near.toFixed(1) : null }
    }, b))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=gossip-cast.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs.slice(0, 6), errN: errs.length })
}
