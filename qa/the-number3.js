async page => {
  // ---------------------------------------------------------------------------
  // qa/the-number3.js — THE ENDING READS IT (item 6, last bullet)
  //
  // TRAP, PAID FOR ONCE: the first cut wrote a complete save, RELOADED, AND
  // THEN CLICKED THE MIDDLE OF THE SCREEN — which is the gesture every probe
  // in this repo opens with to unlock audio, and which on the title card is a
  // press on `start a new journey`. The restore was thrown away before the
  // game began and `notoAudit` came back at zero on a file carrying 44 points.
  // qa/pf2-finale.js does not click, and this is why.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  // ...AND THE FIXTURE IS WRITTEN FROM A PAGE THAT HAS NOT STARTED A GAME.
  // `pagehide` flushes the save (see the listener beside applyDPR), and
  // page.reload() fires pagehide — so writing a fixture from a running game
  // and reloading writes the LIVE state straight back over it. The first cut
  // came back with the previous probe's ten ticks on a file carrying 231.
  // This reload lands on the title card, where there is no game to flush.
  await page.reload()
  await page.waitForTimeout(3500)
  const ids = await page.evaluate(async () => (await fetch('/qa/all-task-ids.json')).json())
  await page.evaluate((o) => {
    localStorage.clear()
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: o.ids, seen: o.seen, recs: {}, ms: 11700000, chapms: {},
      finds: [], foundAt: {}, biome: 'sydney', fin: 0, inc: o.inc, scn: o.scn,
    }))
  }, { ids: ids, seen: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
       // Real trouble in eleven of the nineteen: 33 + 11 + 11 = 55, tier 4.
       inc: { 1:3, 2:3, 3:3, 4:3, 5:3, 6:3, 7:3, 8:3, 9:3, 10:3, 11:3 },
       scn: { 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:1, 9:1, 10:1, 11:1 } })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(12000)

  const out = {}
  out.restored = await page.evaluate(() => {
    const g = window.__capy
    return { done: g.hud.tasksDone(), noto: g.hud.notoAudit(),
             biome: g.biome && g.biome.current }
  })

  await page.evaluate(() => {
    const b = window.__capy.capy.body
    window.__pin = setInterval(() => {
      b.position.set(30, b.position.y, 26)
      b.velocity.set(0, 0, 0)
      b.angularVelocity.set(0, 0, 0)
    }, 40)
  })
  await page.waitForTimeout(16000)
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
                                 e => e.textContent).slice(0, 5) }
  })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-number3.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs }, out))
}
