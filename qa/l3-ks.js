async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  const out = { rows: [], errs }
  for (const key of ['Digit6', 'Minus']) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5000)
    await page.keyboard.press(key)
    await page.waitForTimeout(25000)
    out.rows.push(await page.evaluate(() => { const g = window.__capy; const a = g.musAudit(); return { biome: g.biome.current, ks: a.ks, ksN: a.ksN, throws: a.throws, err: g.state.lastError || null } }))
  }
  await page.evaluate((o) => fetch('/shot?name=l3-ks.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
