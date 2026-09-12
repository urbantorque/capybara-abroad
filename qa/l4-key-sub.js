async page => {
  // L4 E1 (a1) — a six-chapter subset of qa/l4-shots2.js for tuning rounds:
  // the same lens and waits, written to qa/l4c-<biome>.png so neither the
  // before set (l4-) nor the last full after set (l4b-) is touched.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  // PINNED TO 'pretty' (a1): under six builders' browsers the perf governor steps
  // down to DPR 0.6 and a 1024 shadow map, which is not the picture being measured.
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  const CH = [['Digit1', 'sydney'], ['Digit2', 'pasto'], ['Digit8', 'sahara'], ['Digit0', 'venice'], ['Equal', 'palawan'], ['BracketRight', 'manly']]
  const out = { rows: [] }
  for (const [key, name] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    await page.screenshot({ path: 'qa/l4c-' + name + '.png', timeout: 90000 })
    out.rows.push(await page.evaluate(() => { const g = window.__capy; return { biome: g.biome.current, err: g.state.lastError || null, key: g.hud && g.hud.keyAudit ? g.hud.keyAudit() : null } }))
  }
  await page.evaluate((o) => fetch('/shot?name=l4c-sub.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
