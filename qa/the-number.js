async page => {
  // ---------------------------------------------------------------------------
  // qa/the-number.js — NOTORIETY (ROADMAP-FUN item 6, B14)
  //
  // Four things, and they fail differently:
  //
  //   1. THE TABLE. Every boundary in sysNOTO_TIERS, walked with forceNoto,
  //      against notoAudit. A projection with a wrong comparison is invisible
  //      from outside because the counters take hours to move.
  //   2. THE ARITHMETIC. That a scene really is worth two incidents and that
  //      spread is worth one per chapter — the two claims the formula rests
  //      on, tested as differentials rather than read off a constant.
  //   3. THE SURFACES. The departures card and the ledger, opened THROUGH
  //      THEIR OWN BUTTONS rather than by a hook, because the strings are
  //      written in a refresh that a hook would skip.
  //   4. THE HEADLINE. That it is absent at tier 0-1, present from 2, that
  //      it names the place, and that it is GONE from the next card that is
  //      not an arrival — the place card is shared by four events and a
  //      headline left on it is the failure this would ship with.
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

  // ---- 1 + 2: the table and the arithmetic --------------------------------
  out.table = await page.evaluate(() => {
    const h = window.__capy.hud
    const rows = []
    const at = h.notoAudit().tiers.map(r => r[0])
    // One below each boundary and exactly on it: an off-by-one in the
    // comparison shows up here and nowhere else.
    for (const b of at) {
      for (const d of [-1, 0]) {
        const n = Math.max(0, b + d)
        const a = h.forceNoto(n, 0, 1)   // one chapter, so spread is 1
        rows.push({ want: n + 1, score: a.score, tier: a.tier, name: a.name })
      }
    }
    return rows
  })
  out.arith = await page.evaluate(() => {
    const h = window.__capy.hud
    const a = h.forceNoto(4, 0, 1)      // 4 incidents in one chapter
    const b = h.forceNoto(2, 2, 1)      // 2 of them scenes: a scene chain
                                        // bumps BOTH tallies, so this is the
                                        // same four chains with two of them
                                        // having gone all the way
    const c = h.forceNoto(4, 0, 4)      // the same four, one per chapter
    return { fourFlat: a.score, twoScenes: b.score, spreadFour: c.score,
             sceneWorth: b.score - a.score, spreadWorth: c.score - a.score }
  })

  // ---- 4a: nothing at all at tier 0 ---------------------------------------
  await page.evaluate(() => { window.__capy.hud.forceNoto(0, 0, 1) })
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(6000)
  out.tier0 = await page.evaluate(() => {
    const e = document.querySelector('.capyui-placenews')
    return { txt: e ? e.textContent : null, hidden: e ? e.hidden : null }
  })
  await page.waitForTimeout(9000)

  // ---- 4b: from tier 2, and it names the place ----------------------------
  const seen = []
  for (const [n, s, c, b] of [[9, 2, 1, 'kyoto'], [24, 5, 3, 'hanoi'],
                              [40, 10, 6, 'kowloon'], [70, 20, 12, 'pasto']]) {
    await page.evaluate((v) => {
      window.__capy.hud.forceNoto(v[0], v[1], v[2])
    }, [n, s, c])
    await page.evaluate((bi) => { window.__capy.hud.cross(bi) }, b)
    await page.waitForTimeout(6000)
    seen.push(await page.evaluate((bi) => {
      const e = document.querySelector('.capyui-placenews')
      const a = window.__capy.hud.notoAudit()
      return { b: bi, tier: a.tier, name: a.name, score: a.score,
               news: e ? e.textContent : null, hidden: e ? e.hidden : null }
    }, b))
    await page.waitForTimeout(9000)
  }
  out.news = seen

  // ---- 4c: and it does NOT survive onto the next card ---------------------
  // The place card is shared by arrivals, act breaks, wow banners and the
  // finale. A headline written by an arrival and never cleared would turn up
  // under the next `wow`, which is the one failure a screenshot of an arrival
  // cannot show.
  out.cleared = await page.evaluate(async () => {
    const e = document.querySelector('.capyui-placenews')
    const before = { txt: e.textContent, hidden: e.hidden }
    // A record banner is the commonest non-arrival use of the card.
    window.__capy.hud.say && window.__capy.hud.say('')
    const h2 = document.querySelector('.capyui-place h2')
    // Drive it the way the game does: any showPlace with two arguments.
    window.__capy.hud.cross('venice', 'A RECORD', 'the long way round')
    await new Promise(r => setTimeout(r, 6000))
    return { before: before, after: { txt: e.textContent, hidden: e.hidden },
             title: h2 ? h2.textContent : null }
  })
  await page.waitForTimeout(9000)

  // ---- 3: the two surfaces, through their own buttons ---------------------
  out.surfaces = await page.evaluate(async () => {
    const byText = t => [].find.call(document.querySelectorAll('button'),
                                     b => (b.textContent || '').trim() === t)
    const press = el => { if (!el) return false
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      el.click(); return true }
    const wait = ms => new Promise(r => setTimeout(r, ms))
    // Escape raises the pause card; its first button raises the departures
    // board; the board's own button raises the ledger.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    await wait(700)
    const okPause = press(byText('the journey so far'))
    await wait(900)
    const jr = document.querySelector('.capyui-jrsub')
    const jrsub = jr ? jr.textContent : null
    const okLed = press(byText('the journey, laid out'))
    await wait(1200)
    const ls = document.querySelector('.capyui-ledsub')
    const lf = document.querySelector('.capyui-ledfoot')
    const leaves = [].map.call(document.querySelectorAll('.capyui-lednoto'),
                               e => e.textContent)
    return { okPause: okPause, okLed: okLed, jrsub: jrsub,
             ledsub: ls ? ls.textContent : null,
             ledfoot: lf ? lf.textContent : null, leaves: leaves }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-number.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs }, out))
}
