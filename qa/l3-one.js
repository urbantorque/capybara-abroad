async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(4800)
  await page.keyboard.press('Slash')
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/l3-one-a.png' })
  const o = await page.evaluate(() => ({ err: window.__capy.state.lastError || null, biome: window.__capy.biome.current }))
  await page.evaluate((o) => fetch('/shot?name=l3-one.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), o)
}
