async page => {
  // A real session with both halves live: crossings that arm gossip, posters
  // going up in every chapter, one taken. B15 adds a per-frame step above
  // npc.js's biome gate, a listener on every arrival that casts up to 120
  // rays, and a new prop type.
  const errs = [], warns = []
  page.on('pageerror', e => errs.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text())
                            else if (m.type() === 'warning') warns.push(m.text()) })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.forceNoto(20, 6, 8, 0, 0) })
  const steps = []
  for (const b of ['kyoto', 'venice', 'cave', 'hanoi', 'goreme']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(12000)
    steps.push(await page.evaluate(() => {
      const g = window.__capy
      const p = (g.props || []).filter(x => x && x.type === 'poster' && !x.removed &&
                                            x.biome === g.biome.current)
      return { b: g.biome.current, poster: p.length, rumour: g.rumourAudit().line,
               tier: g.hud.notoAudit().name }
    }))
  }
  await page.evaluate(() => {
    const g = window.__capy
    const p = (g.props || []).find(x => x && x.type === 'poster' && !x.removed &&
                                        x.biome === g.biome.current)
    if (!p) return
    g.capy.body.position.set(p.body.position.x + 0.5, p.body.position.y + 0.4,
                             p.body.position.z)
    g.capy.body.velocity.set(0, 0, 0)
    setTimeout(() => { try { g.physics.grab(p) } catch (e) {} }, 500)
  })
  await page.waitForTimeout(4000)
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=b15-clean.json', { method: 'POST', body: s })
  }, { steps: steps, errs: errs.slice(0, 8), errN: errs.length,
       warns: warns.slice(0, 8), warnN: warns.length })
}
