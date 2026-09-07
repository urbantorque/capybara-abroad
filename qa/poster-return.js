async page => {
  // One poster goes up on EVERY arrival, so a chapter you keep coming back to
  // must not end up with a forest of them. props.js tags anything added
  // between `captureTag = to` and the `biome:enter` emit into the live
  // chapter's capture set — which is why the spawn lives in that handler —
  // and the set is dropped on the way out. This is that claim, tested.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.forceNoto(20, 6, 8, 0, 0) })
  const rows = []
  for (let i = 0; i < 6; i++) {
    const b = i % 2 ? 'venice' : 'kyoto'
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      const live = g.biome.current
      const all = (g.props || []).filter(x => x && x.type === 'poster')
      return { pass: n, b: live,
               mine: all.filter(x => x.biome === live && !x.removed).length,
               inArray: all.length, alive: all.filter(x => !x.removed).length,
               bodies: all.filter(x => !x.removed && x.body && x.body.world).length }
    }, i))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=poster-return.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs.slice(0, 4), errN: errs.length })
}
