async page => {
  // ---------------------------------------------------------------------------
  // qa/the-number2.js — THE THREE THINGS the-number.js COULD NOT ANSWER (B14)
  //
  //   1. THE ARITHMETIC, AS THE RIGHT DIFFERENTIAL. The first cut compared
  //      four incident chains against TWO scene chains and reported that a
  //      scene is worth nothing. Both sides scored 5 and both sides were
  //      right: four chains that stopped at three and two chains that went
  //      all the way ARE worth the same, which is the 2:1 weighting working.
  //      The differential that tests the claim holds the number of CHAINS
  //      fixed and upgrades some of them.
  //   2. THE CLEAR-DOWN. showPlace is shared by arrivals, act breaks, wow
  //      banners and the finale, and a headline left on the element would
  //      turn up under the next one. Driven here by arriving at tier 5 and
  //      then at tier 0, which takes the same `news || ''` branch a non-
  //      arrival takes.
  //   3. THE ENDING. `ledFinal` is only ever set by the lawn, so the last
  //      sentence this game says needs a complete save and a capybara sitting
  //      in a 2.6 m ring at (30, 26) in Sydney — see sysFIN_X.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  const out = {}

  // ---- 1 + 2 --------------------------------------------------------------
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  out.arith = await page.evaluate(() => {
    const h = window.__capy.hud
    // FOUR CHAINS in one chapter, none / two / all of them going to five.
    // A scene chain increments BOTH tallies, so "four chains, two of them
    // scenes" is inc 4, scn 2.
    const none = h.forceNoto(4, 0, 1).score
    const two = h.forceNoto(4, 2, 1).score
    const all = h.forceNoto(4, 4, 1).score
    // ...and the same four chains spread over four chapters.
    const flat = h.forceNoto(4, 0, 1).score
    const wide = h.forceNoto(4, 0, 4).score
    return { none: none, two: two, all: all,
             perScene: (two - none) / 2, sceneIsWorth: all / none,
             spreadPerChapter: (wide - flat) / 3 }
  })

  await page.evaluate(() => { window.__capy.hud.forceNoto(70, 20, 12) })
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(7000)
  const hot = await page.evaluate(() => {
    const e = document.querySelector('.capyui-placenews')
    return { txt: e.textContent, hidden: e.hidden }
  })
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.forceNoto(0, 0, 1) })
  await page.evaluate(() => { window.__capy.hud.cross('kyoto') })
  await page.waitForTimeout(7000)
  const cold = await page.evaluate(() => {
    const e = document.querySelector('.capyui-placenews')
    return { txt: e.textContent, hidden: e.hidden }
  })
  out.cleared = { hot: hot, cold: cold }

  // ---- 3: the ending ------------------------------------------------------
  const ids = await page.evaluate(async () => (await fetch('/qa/all-task-ids.json')).json())
  await page.evaluate((o) => {
    localStorage.clear()
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: o.ids, seen: o.seen, recs: {}, ms: 11700000, chapms: {},
      finds: [], foundAt: {}, biome: 'sydney', fin: 0,
      // A journey that caused real trouble in eleven of the nineteen: score
      // 44 + 11 = 55, which is tier 4. The ending is the one surface where
      // the tier is a verdict and it has to be the right one.
      inc: o.inc, scn: o.scn,
    }))
  }, { ids: ids, seen: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
       inc: { 1:3, 2:3, 3:3, 4:3, 5:3, 6:3, 7:3, 8:3, 9:3, 10:3, 11:3 },
       scn: { 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:1, 9:1, 10:1, 11:1 } })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(11000)

  out.endScore = await page.evaluate(() => window.__capy.hud.notoAudit())

  // Sit on the lawn. sysFIN_IN is 1.8 m and sysFIN_LOAF wants the animal
  // SETTLED, not merely standing there, so the body is pinned still for
  // longer than sysFIN_HOLD.
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    window.__pin = setInterval(() => {
      b.position.set(30, b.position.y, 26)
      b.velocity.set(0, 0, 0)
      b.angularVelocity.set(0, 0, 0)
    }, 40)
  })
  await page.waitForTimeout(14000)
  out.ending = await page.evaluate(() => {
    clearInterval(window.__pin)
    const t = document.querySelector('.capyui-led h2')
    const s = document.querySelector('.capyui-ledsub')
    const f = document.querySelector('.capyui-ledfoot')
    const el = document.querySelector('.capyui-led')
    return { shown: el ? el.classList.contains('show') : null,
             title: t ? t.textContent : null,
             sub: s ? s.textContent : null,
             foot: f ? f.textContent : null,
             leaves: [].map.call(document.querySelectorAll('.capyui-lednoto'),
                                 e => e.textContent).slice(0, 4) }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-number2.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs }, out))
}
