async page => {
  // ---------------------------------------------------------------------------
  // qa/eng-rate6.js — INCIDENTS PER 45 s, SIX CHAPTERS (ROADMAP-FUN, item 4d)
  //
  // qa/eng-rate.js is the nineteen-chapter version and takes a quarter of an
  // hour a side, which is too long to run twice and far too long to run four
  // times — and it has to be run four times, because a random-input masher in
  // a game full of `Math.random()` does not hold a line and a single before /
  // single after pair cannot tell a change from the noise.
  //
  // Six chapters, chosen because four of them had NOTHING that breaks or
  // spills before this batch (Göreme, Monte Carlo, Manly, Sơn Đoòng) and two
  // are the controls that already had both (Sydney, Venice).
  //
  // Entered with hud.cross, not switchTo — trap 36.
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

  await page.evaluate(() => {
    const g = window.__capy, W = window
    W.__n = {}
    W.__on = false
    const bump = k => { if (W.__on) W.__n[k] = (W.__n[k] || 0) + 1 }
    g.events.on('prop:destroy', () => bump('broke'))
    g.events.on('prop:impact', p => { if (p && p.spill) bump('spilt'); else if (p && p.speed > 2.6) bump('bang') })
    g.events.on('npc:startled', () => bump('startled'))
    g.events.on('npc:chase', () => bump('chase'))
    g.events.on('capy:grab', () => bump('grab'))
    new MutationObserver(ms => {
      for (const m of ms) for (const nd of m.addedNodes) {
        if (/AN INCIDENT|A SCENE/.test(nd.textContent || '')) bump('card')
      }
    }).observe(document.body, { childList: true, subtree: true })

    // The same xorshift masher eng-rate.js uses, so the two are comparable.
    W.__startDrive = seed => {
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft']
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      let s = seed | 0 || 1
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
      const held = new Set()
      const cb = g.capy.body
      let px = cb.position.x, pz = cb.position.z
      W.__dist = 0
      const iv = setInterval(() => {
        if (rnd() < 0.10) {
          const k = KEYS[(rnd() * KEYS.length) | 0]
          if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) }
        }
        W.__dist += Math.hypot(cb.position.x - px, cb.position.z - pz)
        px = cb.position.x; pz = cb.position.z
      }, 16)
      W.__stopDrive = () => { clearInterval(iv); for (const k of held) up(k) }
    }
  })

  const NAMES = ['sydney', 'venice', 'goreme', 'monaco', 'manly', 'cave']
  const out = []
  for (const name of NAMES) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, name)
    await page.waitForTimeout(12000)
    await page.evaluate((n) => {
      const W = window
      for (const k in W.__n) delete W.__n[k]
      W.__on = true
      W.__startDrive(12345 + n.length * 7919)
    }, name)
    await page.waitForTimeout(45000)
    out.push(await page.evaluate(() => {
      window.__on = false
      window.__stopDrive()
      return { b: window.__capy.biome.current, dist: Math.round(window.__dist),
               n: Object.assign({}, window.__n) }
    }))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=engrate6.json', { method: 'POST', body: s })
  }, { rows: out, errs: errs })
}
