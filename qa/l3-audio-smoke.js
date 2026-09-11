async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit6')
  await page.waitForTimeout(8000)
  const r = await page.evaluate(() => {
    const g = window.__capy
    const out = { biome: g.biome.current, ac: null, played: [] }
    for (const n of ['grunt', 'click', 'chatter', 'tick', 'step', 'blip']) {
      try { g.sfx(n, { volume: 0.5, pitch: 1, force: true }); out.played.push(n) } catch (e) { out.played.push(n + ':' + e.message) }
    }
    try { const a = g.musAudit ? g.musAudit() : null; out.mus = a && { pal: a.pal, band: a.band, beat: a.beatLen } } catch (e) { out.mus = 'err ' + e.message }
    return out
  })
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
  await page.waitForTimeout(500)
  const err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l3-audio.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), { r, err, errs: errs.slice(0, 10) })
}
