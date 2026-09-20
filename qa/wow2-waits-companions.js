async page => {
  // ROADMAP-WOW2 W6 closeout — N3.3, the other five companion kinds live.
  // wow2-waits.js (N3's own instrument) proved the pigeon/Venice homecoming
  // end to end and left the other five "share identical code, checked by
  // reading" for lack of time. Same save-forced-stow pattern, one kind per
  // reload: cat/goreme, silver gull/manly, gentoo/antarctic, heron/kyoto,
  // ibis/sydney.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(4500)
  const oneTaskId = (await page.evaluate(() => (window.__capy.tasksInChapter(1) || [])[0])) || 'wheek-sydney'
  const KINDS = [['cat', 'goreme'], ['silver gull', 'manly'], ['gentoo', 'antarctic'], ['heron', 'kyoto'], ['ibis', 'sydney']]
  const out = { errs, oneTaskId, rows: {} }
  for (const [kind, biome] of KINDS) {
    await page.addInitScript((o) => {
      try {
        localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: [o.tid], seen: [1], recs: {}, ms: 0, stow: { kind: o.kind, from: o.biome } }))
      } catch (e) {}
    }, { tid: oneTaskId, kind, biome })
    await page.goto('http://localhost:5188/index.html')
    await page.waitForTimeout(4200)
    await page.evaluate(() => { const c = document.querySelector('.capyui-carry'); if (c) c.click(); else document.querySelector('.capyui-go').click() })
    await page.waitForTimeout(4200)
    const atBoot = await page.evaluate(() => window.__capy.stowDebug())
    await page.evaluate((n) => window.__capy.hud.cross(n), biome)
    await page.waitForTimeout(9500)
    const atHome = await page.evaluate(() => window.__capy.stowDebug())
    out.rows[kind] = { biome, atBoot, atHome }
  }
  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow2-waits-companions', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
