async page => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.evaluate(() => { window.__capy.biome.switchTo('sahara') })
  await page.waitForTimeout(9000)
  const out = { biome: await page.evaluate(() => window.__capy.biome.current) }
  await page.evaluate(() => { const g = window.__capy; for (let i = 0; i < 120; i++) g.tick(0.033, false) })
  await page.waitForTimeout(1500)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-17.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
