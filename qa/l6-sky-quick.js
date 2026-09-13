async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { rows: [] }
  const CH = ['sydney', 'rio', 'sahara', 'hanoi']
  for (const c of CH) {
    await page.evaluate((c) => window.__capy.hud.cross(c), c)
    await page.waitForTimeout(9000)
    await page.screenshot({ path: 'qa/l6-sky-q-' + c + '-arrive.png' })
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3200)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    await page.screenshot({ path: 'qa/l6-sky-q-' + c + '-rest.png' })
    out.rows.push(await page.evaluate(() => { const g = window.__capy; return { biome: g.biome.current, err: g.state.lastError ? String(g.state.lastError) : null } }))
  }
  await page.evaluate((o) => fetch('/shot?name=l6-sky-quick.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
