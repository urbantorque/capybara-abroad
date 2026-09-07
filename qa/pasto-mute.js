async page => {
  // ---------------------------------------------------------------------------
  // qa/pasto-mute.js — EIGHT PEOPLE WITHIN SIXTEEN METRES AND NOBODY SPOKE
  //
  // gossip-premise.js: Pasto counts 8 within 16 m through `peopleNear` and
  // `sayNear` returns false there. Both walk `paHumans`, so the difference is
  // entirely in sayNear's eligibility test — `group.visible`, `talkCd`, and a
  // state that is not flee/plunge/swim. Which of the three is refusing, and
  // is it Pasto only or Sydney too?
  //
  // It matters beyond B15: `sayNear` is the chapter-neutral speaking hook and
  // B3's 150-second nudge goes through it as well.
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

  const out = {}
  for (const b of ['pasto', 'sydney']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(9000)
    out[b] = await page.evaluate(() => {
      const g = window.__capy, p = g.capy.position
      // npcs is Sydney's array and it ACCUMULATES (trap 30), so this walks it
      // with a distance filter and reports the states rather than trusting it.
      const rows = []
      for (const h of (g.npcs || [])) {
        if (!h || !h.group) continue
        const d = Math.hypot(h.group.position.x - p.x, h.group.position.z - p.z)
        if (d > 20) continue
        rows.push({ d: +d.toFixed(1), vis: !!h.group.visible,
                    cd: +(h.talkCd || 0).toFixed(1), st: h.state || null,
                    speak: typeof h.speak })
      }
      rows.sort((a, b2) => a.d - b2.d)
      return { near: rows.length, rows: rows.slice(0, 8),
               said: !!g.sayNear(p.x, p.z, 16, 'Testing, one two.'),
               count: g.peopleNear(p.x, p.z, 16) }
    })
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=pasto-mute.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs.slice(0, 6), errN: errs.length }, out))
}
