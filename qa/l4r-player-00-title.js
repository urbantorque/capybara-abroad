async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l4r-player-title-1.png' })
  const out = {}
  out.titleText = await page.evaluate(() => document.body.innerText)
  // a curious player presses things on the title
  await page.keyboard.press('Space')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/l4r-player-title-2.png' })
  out.afterSpace = await page.evaluate(() => document.body.innerText)
  out.state = await page.evaluate(() => { const g = window.__capy; return g ? { biome: g.biome && g.biome.current, started: g.state && g.state.started, keys: Object.keys(g.state || {}).slice(0, 80) } : null })
  await page.evaluate((o) => fetch('/shot?name=l4r-player-00.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
