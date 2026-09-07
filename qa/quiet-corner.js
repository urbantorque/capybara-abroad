async page => {
  // ---------------------------------------------------------------------------
  // qa/quiet-corner.js — IS THE QUIET CORNER A FREE TICK IN THE DRIFT?
  //
  // The find is `findPeople(p, 55) === 0 && findPeople(p, 1e4) >= 6`, and its
  // own comment says the second clause is there so it is "a real corner of a
  // populated place and not a free tick in the Drift".
  //
  // `findPeople` filters `game.locals` by chapter and walks `game.npcs`
  // WITHOUT one, and `game.npcs` accumulates — so at ten thousand metres the
  // second clause asks "has this session ever visited Sydney", not "does this
  // chapter have people in it".
  //
  // Two passes, and the pair is the whole experiment:
  //   A. straight to the Drift from the title. `game.npcs` is empty, so the
  //      find must NOT fire.
  //   B. Sydney first, then the Drift. If it fires now, the clause is measuring
  //      the session rather than the chapter.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))

  async function run(viaSydney) {
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
    await page.reload()
    await page.waitForTimeout(5000)
    await page.mouse.click(400, 400)
    await page.waitForTimeout(900)
    if (viaSydney) {
      await page.keyboard.press('Digit1')
      await page.waitForTimeout(9000)
      await page.evaluate(() => { window.__capy.hud.cross('drift') })
    } else {
      // Digit9 is chapter 9, the Drift. Straight in, no Sydney.
      await page.keyboard.press('Digit9')
    }
    await page.waitForTimeout(12000)
    // Stand still: the find sweep runs on the hint beat, four times a second.
    await page.evaluate(() => new Promise(r => setTimeout(r, 9000)))
    return page.evaluate(() => {
      const g = window.__capy
      const p = g.capy.position
      let cast = 0
      for (const q of (g.npcs || [])) if (q && q.group) cast++
      let near55 = 0
      for (const q of (g.npcs || [])) {
        const gp = q && q.group && q.group.position
        if (gp && Math.hypot(gp.x - p.x, gp.z - p.z) < 55) near55++
      }
      return { biome: g.biome.current, castTotal: cast, castWithin55: near55,
               quiet: g.noticed('quiet-corner'), finds: g.noticed() }
    })
  }

  const a = await run(false)
  const b = await run(true)
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=quiet-corner.json', { method: 'POST', body: s })
  }, { straight: a, viaSydney: b, errs: errs })
}
