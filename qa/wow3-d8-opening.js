async page => {
  // ROADMAP-WOW3 D8 — THE OPENING, LIVE. Fresh boot (no init-script save, so
  // this is genuinely a fresh file), Begin, and read game.openAudit()/the
  // animal's own nap/loaf fields through the beat: is it armed, is the
  // animal actually asleep (capy.nap/capy.loaf, published on the animal
  // itself), is the bag visible, and does BOTH clear cleanly when the beat
  // ends. Two runs: one that lets the 10 s hold finish, one that presses a
  // key early — "skippable by any key" is only proved by actually skipping.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })

  const out = { errs, samples: [] }
  // sample every ~500 ms for 3 s: armed, capy.nap, capy.loaf, bag visible
  for (let i = 0; i < 6; i++) {
    const s = await page.evaluate(() => {
      const g = window.__capy
      const oa = g.openAudit ? g.openAudit() : null
      let bag = null
      g.scene.traverse(o => { if (o.isGroup && o.children && o.children.length === 2 &&
        o.children[0] && o.children[0].geometry && o.children[0].geometry.type === 'BoxGeometry' &&
        o.children[1] && o.children[1].geometry && o.children[1].geometry.type === 'BoxGeometry' &&
        Math.abs(o.children[0].position.y - 0.21) < 0.001) bag = { visible: o.visible, pos: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)] } })
      return { t: +g.state.time.toFixed(2), openArmed: oa && oa.armed, openT: oa && oa.t,
               nap: +g.capy.nap.toFixed(3), loaf: +g.capy.loaf.toFixed(3), bag, capyPos: [+g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2)] }
    })
    out.samples.push(s)
    await page.waitForTimeout(500)
  }
  // ---- a screenshot while it is still up ---------------------------------
  await page.screenshot({ path: 'qa/wow3-d8-opening-asleep.png' })

  // ---- now skip it with a key, and confirm the release --------------------
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  out.afterSkip = await page.evaluate(() => {
    const g = window.__capy
    const oa = g.openAudit ? g.openAudit() : null
    return { openArmed: oa && oa.armed, openT: oa && oa.t, nap: +g.capy.nap.toFixed(3), loaf: +g.capy.loaf.toFixed(3) }
  })
  await page.waitForTimeout(1500)
  out.afterSkipSettled = await page.evaluate(() => {
    const g = window.__capy
    return { nap: +g.capy.nap.toFixed(3), loaf: +g.capy.loaf.toFixed(3) }
  })
  await page.screenshot({ path: 'qa/wow3-d8-opening-after.png' })

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow3-d8-opening.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
