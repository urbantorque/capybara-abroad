async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6500)
  await page.mouse.click(500, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    return { keys: Object.keys(g), api: g.goreme ? Object.keys(g.goreme) : null,
             hasTick: typeof g.tick, cam: g.camera ? 'yes' : 'no',
             inputKeys: g.input ? Object.keys(g.input) : null }
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4gor-0.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
