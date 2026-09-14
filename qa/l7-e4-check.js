async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  const logs = []
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(t + ': ' + m.text().slice(0, 600)) })
  page.on('pageerror', e => logs.push('pageerror: ' + String(e).slice(0, 600)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, rows: [] }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const CH = ['cave', 'venice', 'quay', 'kowloon']
  for (const c of CH) {
    await page.evaluate((c) => window.__capy.hud.cross(c), c)
    await page.waitForTimeout(9000)
    await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    await page.screenshot({ path: 'qa/l7-e4-check-' + c + '.png' })
    out.rows.push(await page.evaluate(() => { const g = window.__capy; return { biome: g.biome.current, err: g.state.lastError || null, cam: g.camera.position.toArray().map(v => +v.toFixed(1)) } }))
  }
  out.logs = logs.slice(0, 40)
  await page.evaluate((o) => fetch('/shot?name=l7-e4-check.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
