async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)
  // walk up to the nearest person and wheek so somebody talks
  await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; let best = null, bd = 1e9; for (const r of g.humans || []) { const d = Math.hypot(r.group.position.x - p.x, r.group.position.z - p.z); if (d < bd) { bd = d; best = r } } if (best) { const b = g.capy.body; const x = best.group.position.x + 1.6, z = best.group.position.z + 1.2; b.position.set(x, p.y + 0.3, z); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) } })
  await page.waitForTimeout(600)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'qa/l3-faces.png' })
  const r = await page.evaluate(() => ({ err: window.__capy.state.lastError || null, n: (window.__capy.humans || []).length }))
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit8')
  await page.waitForTimeout(12000)
  await page.screenshot({ path: 'qa/l3-faces-sahara.png' })
  const r2 = await page.evaluate(() => ({ err: window.__capy.state.lastError || null }))
  await page.evaluate((o) => fetch('/shot?name=l3-faces.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), { r, r2, errs })
}
