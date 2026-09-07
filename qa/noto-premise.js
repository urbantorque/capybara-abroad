async page => {
  // ---------------------------------------------------------------------------
  // qa/noto-premise.js — WHAT IS THERE TO PROJECT? (ROADMAP-FUN item 6, B14)
  //
  // Item 6 says notoriety is `f(Σ jrChapInc, Σ jrChapScene, records beaten,
  // finds)` in five tiers, and gives not one number for where a tier begins.
  // A tier table is a guess unless somebody has measured what a player
  // actually accumulates, so this measures three things BEFORE anything is
  // built:
  //
  //   1. THE RATE. Four chapters, 90 s of the eng-rate masher in each, then
  //      the save read back. Incidents and scenes per minute of active
  //      mischief is the only honest input to a tier boundary.
  //   2. THE CEILING. What the four terms can reach at all: FINDS.length,
  //      the number of RECORDS carrying a par, 231 tasks, 19 chapters.
  //   3. THE SURFACES. The exact strings on the two places the item says the
  //      number goes — the departures card's subtitle and the ledger's — and
  //      the arrival card's DOM, because "the card's second line" is a claim
  //      about a card that may already have one.
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

  // ---- 2 + 3: the ceiling and the surfaces, before anything is disturbed ---
  const stock = await page.evaluate(() => {
    const g = window.__capy
    const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }
    // The arrival card, as built. showPlace(title, sub) writes exactly two
    // elements; this reports what is in it and what it is made of.
    const pl = document.querySelector('.capyui-place')
    const place = pl ? {
      kids: [].map.call(pl.children, c => ({ cls: c.className, tag: c.tagName,
                                             txt: (c.textContent || '').slice(0, 60) })),
      n: pl.children.length,
    } : null
    return {
      jrsub: q('.capyui-jrsub'),
      ledsub: q('.capyui-ledsub'),
      place: place,
      noticed: typeof g.hud.noticed === 'function' ? g.hud.noticed() : null,
      charm: g.hud.charmAudit(),
      tasks: g.hud.tasksDone(),
    }
  })

  // ---- 1: the rate --------------------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy, W = window
    W.__n = {}
    W.__on = false
    const bump = k => { if (W.__on) W.__n[k] = (W.__n[k] || 0) + 1 }
    new MutationObserver(ms => {
      for (const m of ms) for (const nd of m.addedNodes) {
        const t = nd.textContent || ''
        if (/AN INCIDENT/.test(t)) bump('inc')
        if (/A SCENE/.test(t)) bump('scn')
      }
    }).observe(document.body, { childList: true, subtree: true })
    W.__startDrive = seed => {
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft']
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      let s = seed | 0 || 1
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
      const held = new Set()
      const iv = setInterval(() => {
        if (rnd() < 0.10) {
          const k = KEYS[(rnd() * KEYS.length) | 0]
          if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) }
        }
      }, 16)
      W.__stopDrive = () => { clearInterval(iv); for (const k of held) up(k) }
    }
  })

  const laps = []
  for (const name of ['sydney', 'venice', 'hanoi', 'kowloon']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, name)
    await page.waitForTimeout(12000)
    await page.evaluate((n) => {
      const W = window
      for (const k in W.__n) delete W.__n[k]
      W.__on = true
      W.__startDrive(20260 + n.length * 7919)
    }, name)
    await page.waitForTimeout(90000)
    laps.push(await page.evaluate((n) => {
      window.__on = false
      window.__stopDrive()
      return { b: n, cards: Object.assign({}, window.__n) }
    }, name))
    await page.waitForTimeout(2500)
  }

  // The save is the only place the per-chapter counts are written down.
  const save = await page.evaluate(() => {
    let s = null
    try { s = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null') } catch (e) {}
    if (!s) return { err: 'no save' }
    const sum = o => { let t = 0; for (const k in (o || {})) t += o[k] || 0; return t }
    return { inc: sum(s.inc), scn: sum(s.scn), pho: sum(s.pho), fed: sum(s.fed),
             finds: (s.finds || []).length, recs: Object.keys(s.recs || {}).length,
             tasks: (s.tasks || []).length, incBy: s.inc, scnBy: s.scn,
             ms: Math.round((s.ms || 0) / 1000) }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=noto-premise.json', { method: 'POST', body: s })
  }, { stock: stock, laps: laps, save: save, errs: errs })
}
