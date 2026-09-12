async page => {
  // L4 F1b — THE CHAPTER TOLD BACK. A seeded journey (Sydney with a scene, an
  // incident, two photographs, a passenger, a record past par, the waiter at
  // tier 3; Kyoto with two incidents), Enter to carry on; then the Sydney
  // marquee completed through game.completeTask so the wow branch runs, and
  // 1.2 s later the album is asked whether the game took its own picture
  // (tag 2). chapRecap(1) and chapRecap(4) read; the done card forced with
  // hud.showDone if it is exposed, and a frame of it. qa/l4-recap.json,
  // qa/l4recap-done.png
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: ['wheek', 'swim'], seen: [1, 4], recs: { 'torii-run': 28.4 }, told: 1, ms: 400000,
      chapms: { 1: 300000, 4: 100000 }, finds: [], foundAt: {}, biome: 'sydney', fin: 0,
      inc: { 1: 1, 4: 2 }, scn: { 1: 1 }, pho: { 1: 2 }, fed: {}, pas: { 1: 2 }, lin: {}, err: {},
      pal: { 1: 3 },
    }))
  })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  out.recap1 = await page.evaluate(() => window.__capy.hud.chapRecap(1))
  out.recap4 = await page.evaluate(() => window.__capy.hud.chapRecap(4))
  out.tag2Before = await page.evaluate(() => window.__capy.hud.wowShotAudit())
  await page.evaluate(() => { window.__capy.completeTask('opera-stage') })
  await page.waitForTimeout(1500)
  out.tag2After = await page.evaluate(() => window.__capy.hud.wowShotAudit())
  out.album = await page.evaluate(() => { const a = window.__capy.hud.albumAudit(); return { n: a.n, last: a.last } })
  await page.waitForTimeout(2500)
  await page.evaluate(() => { const h = window.__capy.hud; if (h.showDone) h.showDone(1, 'nineteen of nineteen') })
  await page.waitForTimeout(1200)
  out.doneCard = await page.evaluate(() => { const el = document.querySelector('.capyui-done'); if (!el) return null
    const img = el.querySelector('img.capyui-shot'); const lines = el.querySelector('.capyui-donelines')
    return { shown: el.classList.contains('show'), img: !!img, imgW: img ? img.naturalWidth : 0, lines: lines ? lines.textContent : null } })
  await page.screenshot({ path: 'qa/l4recap-done.png', timeout: 90000 })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l4-recap.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
