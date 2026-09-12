async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  const out = { rows: [], errs }
  for (const key of ['Digit0', 'Digit7', 'Quote']) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5000)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    const r = await page.evaluate(() => { const g = window.__capy; const a = g.hud.moverAudit ? g.hud.moverAudit() : null; return { biome: g.biome.current, movers: a, err: g.state.lastError || null } })
    out.rows.push(r)
  }
  await page.evaluate((o) => fetch('/shot?name=l3-beds.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
