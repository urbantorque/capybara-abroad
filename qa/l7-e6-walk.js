async page => {
  // THE PEOPLE OF THIS SQUARE (L7, E6): a 90 s naive walk per chapter, every
  // bubble logged. NINETY GAME SECONDS, not wall seconds: the first run of this
  // was on a machine carrying five other agents' browsers, dt was capped and
  // the clock ran at a sixth, so Kyoto's "90 s" held one exchange. The loop
  // reads game.state.time and stops at +90, with a wall ceiling of 400 s.
  const log = { walks: [] }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  log.started = await page.evaluate(() => window.__capy.state.started)
  const snap = () => page.evaluate(() => {
    const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 1 }
    const o = { bubbles: [], err: window.__capy.state.lastError ? String(window.__capy.state.lastError) : null, gt: window.__capy.state.time }
    for (const el of document.querySelectorAll('.capynpc-bubble')) if (vis(el)) o.bubbles.push((el.innerText || '').replace(/\s+/g, ' ').trim())
    return o
  })
  const walk = async (biome, secs) => {
    const seen = new Set(); const lines = []; let err = null
    const t0 = Date.now()
    const g0 = await page.evaluate(() => window.__capy.state.time)
    let gt = g0, s = 0
    await page.keyboard.down('KeyW')
    while (gt - g0 < secs && Date.now() - t0 < 400000) {
      if (s % 10 === 0) { await page.keyboard.down('KeyA'); await page.waitForTimeout(600); await page.keyboard.up('KeyA') }
      if (s % 14 === 7) { await page.keyboard.press('Space') }
      await page.waitForTimeout(1400)
      const sn = await snap()
      gt = sn.gt
      if (sn.err) err = sn.err
      const t = Math.round(gt - g0)
      for (const x of sn.bubbles) if (!seen.has(x)) { seen.add(x); lines.push({ t, x }) }
      s += 2
    }
    await page.keyboard.up('KeyW')
    log.walks.push({ biome, secs: Math.round(gt - g0), wall: Math.round((Date.now() - t0) / 1000), lines, err })
  }
  const CH = WALK_CHAPTERS
  for (const b of CH) {
    if (b !== 'sydney') {
      await page.evaluate((bb) => window.__capy.hud.cross(bb), b)
      await page.waitForTimeout(9000)
    }
    const live = await page.evaluate(() => window.__capy.biome.current)
    if (live !== b) { log.walks.push({ biome: b, secs: 0, lines: [], err: 'not live: ' + live }); continue }
    await walk(b, 90)
    await page.screenshot({ path: 'qa/l7-e6-walk-' + b + '.png' })
  }
  await page.evaluate((o) => fetch('/shot?name=WALK_NAME.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
