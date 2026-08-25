async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(600)
  await page.evaluate(() => { window.__capy.biome.switchTo('cave') })
  await page.waitForTimeout(9000)
  const out = {}
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(() => { const g = window.__capy; for (let i = 0; i < 90; i++) g.tick(0.033, false) })
  await page.waitForTimeout(1500)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-15.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
