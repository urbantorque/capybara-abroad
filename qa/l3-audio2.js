async page => {
  // pad spectra, the bass walk, the lip and the bar: no throws in a pad palette, a band palette and a reed palette
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  const out = { rows: [], errs }
  for (const key of ['Digit1', 'Digit5', 'Slash']) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5000)
    await page.keyboard.press(key)
    await page.waitForTimeout(20000)
    const r = await page.evaluate(() => { const g = window.__capy; const a = g.musAudit(); return { biome: g.biome.current, pal: a.pal, throws: a.throws, err: g.state.lastError || null } })
    out.rows.push(r)
  }
  await page.evaluate((o) => fetch('/shot?name=l3-audio2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
