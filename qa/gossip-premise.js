async page => {
  // ---------------------------------------------------------------------------
  // qa/gossip-premise.js — IS THERE ANYBODY TO HEAR IT? (item 6, B15)
  //
  // The gossip bullet says `npcPLACE_SAY` gets a `heard:` pool about the
  // PREVIOUS place. Three premises, and the first two hold:
  //
  //   1. THERE IS A PREVIOUS PLACE. `biome:enter` has carried
  //      `{ name, from }` since F3 and nothing has ever read `from`.
  //   2. THERE IS A CHAPTER-NEUTRAL WAY TO SAY IT. `saySomebodyNear` walks
  //      Sydney's `humans`, Pasto's `paHumans` AND `locals` — it is the one
  //      speaking hook in npc.js that is not two chapters or seventeen. The
  //      fifth time this question has come up in this pass and the first time
  //      the answer already existed.
  //   3. SOMEBODY HAS TO BE STANDING NEAR WHERE YOU LAND. Nothing guarantees
  //      that, and it is the whole feature: a line nobody is close enough to
  //      say is a pool that ships and never plays.
  //
  // So: cross into all nineteen, the real way (hud.cross -> biomeFadeTo), and
  // four seconds after arrival count who is within earshot at four radii —
  // then actually fire one line and see whether it lands.
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

  // Does anything read `from` today, and does it arrive?
  await page.evaluate(() => {
    window.__from = []
    window.__capy.events.on('biome:enter', e => {
      window.__from.push({ name: e && e.name, from: e && e.from })
    })
  })

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
    await page.waitForTimeout(4000)
    rows.push(await page.evaluate((n) => {
      const g = window.__capy, p = g.capy.position
      const at = r => g.peopleNear(p.x, p.z, r)
      // ...and the real thing: one line, at the radius the feature would use.
      const said = g.sayNear(p.x, p.z, 16, 'They are talking about you.')
      return { b: n, r6: at(6), r10: at(10), r16: at(16), r24: at(24),
               said: !!said }
    }, b))
    await page.waitForTimeout(6500)
  }

  const from = await page.evaluate(() => window.__from.slice(0, 6))

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=gossip-premise.json', { method: 'POST', body: s })
  }, { rows: rows, from: from, errs: errs.slice(0, 6), errN: errs.length })
}
