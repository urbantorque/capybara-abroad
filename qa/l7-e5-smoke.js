async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  await page.goto('http://localhost:5190/', { waitUntil: 'commit', timeout: 120000 }); await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 }); await page.waitForTimeout(3000)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(6000)
  const out = await page.evaluate(() => { const g = window.__capy; return { started: g && g.state.started, err: g && g.state.lastError, biome: g && g.biome.current } })
  out.errs = errs
  await page.evaluate(o => fetch('/shot?name=l7-e5-smoke.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
