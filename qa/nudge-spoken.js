async page => {
  // ---------------------------------------------------------------------------
  // qa/nudge-spoken.js — DOES SOMEBODY SAY THE NUDGE? (ROADMAP-FUN, item 1d)
  //
  // `sysNUDGE_T` is 150 s of banked time, so this stands still for longer than
  // that and watches BOTH channels: the person's `speak` (wrapped on the
  // records, because the function inside npc.js is closure-local) and the toast
  // rail (a MutationObserver, because `toast()` is closure-local in systems.js
  // and a wrapper on it sees nothing — the same note the roadmap makes).
  //
  // Two chapters: Sydney, which has a crowd, and Sơn Đoòng, which has nobody at
  // all and must therefore still get the toast. A nudge that only arrives where
  // there is a crowd goes missing exactly where a player is most lost.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  const out = []
  for (const b of ['sydney', 'cave']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(7000)
    await page.evaluate(() => {
      const g = window.__capy
      window.__spoke = []
      window.__toasts = []
      for (const r of g.npcs) {
        if (!r || typeof r.speak !== 'function' || r.__w) continue
        r.__w = true
        const raw = r.speak.bind(r)
        r.speak = function (t) { window.__spoke.push({ t: t, fig: !!r.fig, biome: r.biome }); return raw(t) }
      }
      const rail = document.querySelector('.capyui-toasts')
      window.__mo = new MutationObserver((recs) => {
        for (const m of recs) for (const n of m.addedNodes) {
          if (n.textContent) window.__toasts.push(n.textContent)
        }
      })
      if (rail) window.__mo.observe(rail, { childList: true })
      window.__clue = (document.querySelector('.capyui-clue') || {}).textContent || ''
      window.__people = g.npcs.filter(r => r && r.fig && r.biome === g.biome.current).length
    })
    // Stand still. 155 s of wall clock against a 150 s banked timer, split so
    // no single evaluate runs past the 20-30 s execution-context limit.
    for (let i = 0; i < 32; i++) {
      await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))
    }
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      if (window.__mo) window.__mo.disconnect()
      return { biome: g.biome.current, want: arg.b, clue: window.__clue,
               people: window.__people,
               spoke: window.__spoke.slice(-14), toasts: window.__toasts.slice(-8),
               lastError: g.state.lastError || null }
    }, { b: b })
    out.push(r)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=nudge-spoken.json', { method: 'POST', body: s })
  }, { rows: out, errs: errs })
}
